import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { SecretsService } from '../../secrets/secrets.service';
import {
  GOOGLE_AUTH_ENDPOINT,
  GOOGLE_CALENDAR_API,
  GOOGLE_CALENDAR_SCOPE,
  MAX_GOOGLE_CALENDARS,
  GOOGLE_TIMEOUT_MS,
  GOOGLE_TOKEN_ENDPOINT,
  GOOGLE_USERINFO_ENDPOINT,
  TOKEN_REFRESH_SKEW_MS,
} from './google-fields';
import {
  CalendarConnection,
  CalendarConnectionDocument,
} from './schemas/calendar-connection.schema';

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}

/** What the OAuth state carries between the redirect and the callback. */
interface OAuthState {
  workspaceId: string;
  userId: string;
  nonce: string;
}

/** Entry of the calendarList of Google; only what the picker needs. */
interface CalendarListEntry {
  id?: string;
  summary?: string;
  summaryOverride?: string;
  primary?: boolean;
  accessRole?: string;
}

/** One calendar of the connected account, as the picker shows it. */
export interface GoogleCalendar {
  id: string;
  name: string;
  primary: boolean;
  /** True when the account may write events on it. */
  writable: boolean;
}

export interface GoogleStatus {
  connected: boolean;
  email: string | null;
  calendarId: string | null;
  syncedAt: Date | null;
  /** False when GOOGLE_CLIENT_ID is not configured on the server. */
  available: boolean;
}

/**
 * OAuth2 of Google: builds the consent URL, exchanges the code and keeps the tokens
 * encrypted. The state is an encrypted blob, so the callback cannot be forged.
 */
@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);

  constructor(
    @InjectModel(CalendarConnection.name)
    private readonly connections: Model<CalendarConnection>,
    private readonly secrets: SecretsService,
    private readonly config: ConfigService,
  ) {}

  /** True once the server has the credentials of the OAuth client. */
  get configured(): boolean {
    return (this.config.get<string>('GOOGLE_CLIENT_ID') ?? '').trim().length > 0;
  }

  authUrl(workspaceId: Types.ObjectId, userId: Types.ObjectId): string {
    this.requireConfigured();

    const state: OAuthState = {
      workspaceId: String(workspaceId),
      userId: String(userId),
      nonce: randomUUID(),
    };
    const params = new URLSearchParams({
      client_id: this.config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      redirect_uri: this.config.getOrThrow<string>('GOOGLE_REDIRECT_URI'),
      response_type: 'code',
      scope: `${GOOGLE_CALENDAR_SCOPE} openid email`,
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state: this.secrets.encrypt(JSON.stringify(state)),
    });

    return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
  }

  /** Callback of Google: turns the code into tokens and stores the connection. */
  async handleCallback(code: string, state: string): Promise<CalendarConnectionDocument> {
    this.requireConfigured();

    const parsed = this.readState(state);
    const tokens = await this.requestTokens({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.getOrThrow<string>('GOOGLE_REDIRECT_URI'),
    });

    if (!tokens.access_token) {
      throw this.invalid('O Google não devolveu um access token.');
    }

    const workspaceId = new Types.ObjectId(parsed.workspaceId);
    const userId = new Types.ObjectId(parsed.userId);
    const existingQuery = this.connections.findOne({ workspaceId, userId, provider: 'google' });

    existingQuery.select('+refreshToken');

    const existing = await existingQuery.exec();
    const refreshToken = tokens.refresh_token
      ? this.secrets.encrypt(tokens.refresh_token)
      : (existing?.refreshToken ?? null);

    await this.connections
      .updateOne(
        { workspaceId, userId, provider: 'google' },
        {
          $set: {
            accessToken: this.secrets.encrypt(tokens.access_token),
            refreshToken,
            expiresAt: this.expiryOf(tokens),
            email: await this.emailOf(tokens.access_token),
            calendarId: this.config.get<string>('GOOGLE_CALENDAR_ID') ?? 'primary',
          },
        },
        { upsert: true },
      )
      .exec();

    const connection = await this.connections
      .findOne({ workspaceId, userId, provider: 'google' })
      .exec();

    if (!connection) {
      throw this.invalid('Não foi possível guardar a conexão.');
    }

    return connection;
  }

  async status(workspaceId: Types.ObjectId, userId: Types.ObjectId): Promise<GoogleStatus> {
    const connection = await this.connections
      .findOne({ workspaceId, userId, provider: 'google' })
      .exec();

    return {
      connected: Boolean(connection),
      email: connection?.email ?? null,
      calendarId: connection?.calendarId ?? null,
      syncedAt: connection?.syncedAt ?? null,
      available: this.configured,
    };
  }

  /**
   * Calendars of the connected account. The list comes from Google, so a token out
   * of reach answers with an empty list instead of breaking the screen.
   */
  async calendars(workspaceId: Types.ObjectId, userId: Types.ObjectId): Promise<GoogleCalendar[]> {
    await this.requireConnection(workspaceId, userId);

    const token = await this.accessTokenFor(workspaceId, userId);

    if (!token) {
      return [];
    }

    const url = `${GOOGLE_CALENDAR_API}/users/me/calendarList?maxResults=${String(
      MAX_GOOGLE_CALENDARS,
    )}`;

    try {
      const response = await fetch(url, {
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
      });

      if (!response.ok) {
        this.logger.warn(`O Google respondeu ${String(response.status)} na lista de agendas.`);

        return [];
      }

      const body = (await response.json()) as { items?: CalendarListEntry[] };

      return (body.items ?? [])
        .filter((item) => typeof item.id === 'string' && item.id.length > 0)
        .map((item) => ({
          id: item.id ?? '',
          name: item.summaryOverride ?? item.summary ?? item.id ?? '',
          primary: item.primary === true,
          writable: item.accessRole === 'owner' || item.accessRole === 'writer',
        }));
    } catch (error) {
      this.logger.warn(
        `Falha ao listar as agendas do Google: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return [];
    }
  }

  /** Calendar the synchronization of this member reads and writes. */
  async chooseCalendar(
    workspaceId: Types.ObjectId,
    userId: Types.ObjectId,
    calendarId: string,
  ): Promise<GoogleStatus> {
    await this.requireConnection(workspaceId, userId);
    await this.connections
      .updateOne({ workspaceId, userId, provider: 'google' }, { $set: { calendarId } })
      .exec();

    return this.status(workspaceId, userId);
  }

  /** Calendar chosen by the member; the env is only the fallback. */
  async calendarIdFor(workspaceId: Types.ObjectId, userId: Types.ObjectId): Promise<string> {
    const connection = await this.connections
      .findOne({ workspaceId, userId, provider: 'google' })
      .exec();

    return connection?.calendarId ?? this.config.get<string>('GOOGLE_CALENDAR_ID') ?? 'primary';
  }

  private async requireConnection(
    workspaceId: Types.ObjectId,
    userId: Types.ObjectId,
  ): Promise<CalendarConnectionDocument> {
    const connection = await this.connections
      .findOne({ workspaceId, userId, provider: 'google' })
      .exec();

    if (!connection) {
      throw new NotFoundException({
        code: 'CALENDAR_CONNECTION_NOT_FOUND',
        message: 'Nenhuma conta do Google conectada.',
      });
    }

    return connection;
  }

  async disconnect(workspaceId: Types.ObjectId, userId: Types.ObjectId): Promise<void> {
    const deleted = await this.connections
      .deleteOne({ workspaceId, userId, provider: 'google' })
      .exec();

    if (deleted.deletedCount === 0) {
      throw new NotFoundException({
        code: 'CALENDAR_CONNECTION_NOT_FOUND',
        message: 'Nenhuma conta do Google conectada.',
      });
    }
  }

  connectionOf(
    workspaceId: Types.ObjectId,
    userId: Types.ObjectId,
  ): Promise<CalendarConnectionDocument | null> {
    const query = this.connections.findOne({ workspaceId, userId, provider: 'google' });

    // `select` apart from the chain keeps the document type intact (Mongoose 9).
    query.select('+accessToken +refreshToken');

    return query.exec();
  }

  /** Every connected account of the workspace range, used by the sync cron. */
  activeConnections(): Promise<CalendarConnectionDocument[]> {
    return this.connections.find({ provider: 'google' }).exec();
  }

  async markSynced(connectionId: Types.ObjectId): Promise<void> {
    await this.connections
      .updateOne({ _id: connectionId }, { $set: { syncedAt: new Date() } })
      .exec();
  }

  /**
   * Valid access token of the connection, refreshed when it is about to expire.
   * null when the account is not connected or the refresh was refused.
   */
  async accessTokenFor(
    workspaceId: Types.ObjectId,
    userId: Types.ObjectId,
  ): Promise<string | null> {
    const connection = await this.connectionOf(workspaceId, userId);

    if (!connection) {
      return null;
    }

    const expiresAt = connection.expiresAt?.getTime() ?? 0;

    if (expiresAt - TOKEN_REFRESH_SKEW_MS > Date.now()) {
      return this.secrets.tryDecrypt(connection.accessToken);
    }

    const refreshToken = this.secrets.tryDecrypt(connection.refreshToken);

    if (!refreshToken) {
      return this.secrets.tryDecrypt(connection.accessToken);
    }

    try {
      const tokens = await this.requestTokens({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      });

      if (!tokens.access_token) {
        return null;
      }

      await this.connections
        .updateOne(
          { _id: connection._id },
          {
            $set: {
              accessToken: this.secrets.encrypt(tokens.access_token),
              expiresAt: this.expiryOf(tokens),
            },
          },
        )
        .exec();

      return tokens.access_token;
    } catch (error) {
      this.logger.warn(
        `Falha ao renovar o token do Google: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return null;
    }
  }

  private async requestTokens(params: Record<string, string>): Promise<TokenResponse> {
    const body = new URLSearchParams({
      ...params,
      client_id: this.config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      client_secret: this.config.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
    });
    const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw this.invalid(`O Google respondeu ${response.status} na troca do token.`);
    }

    return (await response.json()) as TokenResponse;
  }

  private async emailOf(accessToken: string): Promise<string | null> {
    try {
      const response = await fetch(GOOGLE_USERINFO_ENDPOINT, {
        headers: { authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
      });

      if (!response.ok) {
        return null;
      }

      const body = (await response.json()) as { email?: string };

      return body.email ?? null;
    } catch {
      return null;
    }
  }

  private expiryOf(tokens: TokenResponse): Date {
    const seconds = typeof tokens.expires_in === 'number' ? tokens.expires_in : 3600;

    return new Date(Date.now() + seconds * 1000);
  }

  private readState(state: string): OAuthState {
    const plain = this.secrets.tryDecrypt(state);

    if (!plain) {
      throw this.invalid('O state do OAuth é inválido.');
    }

    try {
      const parsed = JSON.parse(plain) as OAuthState;

      if (!Types.ObjectId.isValid(parsed.workspaceId) || !Types.ObjectId.isValid(parsed.userId)) {
        throw new Error('invalid state payload');
      }

      return parsed;
    } catch {
      throw this.invalid('O state do OAuth é inválido.');
    }
  }

  private requireConfigured(): void {
    if (!this.configured) {
      throw this.invalid('A integração com o Google Agenda não está configurada.');
    }
  }

  private invalid(message: string): BadRequestException {
    return new BadRequestException({ code: 'INVALID_GOOGLE_INTEGRATION', message });
  }
}
