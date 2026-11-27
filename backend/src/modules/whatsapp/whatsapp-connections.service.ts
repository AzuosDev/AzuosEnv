import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SecretsService } from '../secrets/secrets.service';
import { WhatsappProviders } from './providers/whatsapp-providers.service';
import { WaCredentials, WaInstanceStatus } from './providers/whatsapp.provider';
import { WaConnection, WaConnectionDocument } from './schemas/wa-connection.schema';
import { SaveWaConnectionDto } from './dto/whatsapp.dto';
import { WA_CONNECTION_STATE, WaConnectionStateEvent } from './whatsapp-events';
import {
  DEFAULT_WA_PROVIDER,
  WA_WEBHOOK_SECRET_BYTES,
  WaCapabilities,
  WaInstanceState,
  statusOfInstanceState,
  waCapabilities,
} from './whatsapp-fields';

export interface WaConnectionStatusResult {
  connection: WaConnectionDocument | null;
  /** URL the provider must call. */
  webhookUrl: string;
  /** What the provider of this connection is able to do. */
  capabilities: WaCapabilities;
}

/** Connection plus the credentials ready to use. */
export interface WaConnectionWithCredentials {
  connection: WaConnectionDocument;
  credentials: WaCredentials;
  /** Cloud API only: what signs the webhook of Meta. */
  appSecret: string;
}

/** QR Code of the pairing, as the Conexão tab shows it. */
export interface WaQrCodeResult {
  qrCode: string | null;
  qrCodeAt: Date | null;
  status: WaConnectionDocument['status'];
  displayPhone: string;
  verifiedName: string;
  /** URL the instance calls, with the secret; only a gestor ever reads it. */
  webhookUrl: string;
}

/** Fields every connection write touches, so the secrets never leak around. */
const WITH_SECRETS = '+accessToken +appSecret +apiKey +webhookSecret +webhookSecretHash +qrCode';

/**
 * The WhatsApp of each workspace. Tokens, API keys and the secret of the webhook
 * are stored encrypted and only leave here as the credentials of a call.
 */
@Injectable()
export class WhatsappConnectionsService {
  private readonly logger = new Logger(WhatsappConnectionsService.name);

  constructor(
    @InjectModel(WaConnection.name) private readonly model: Model<WaConnection>,
    private readonly providers: WhatsappProviders,
    private readonly secrets: SecretsService,
    private readonly config: ConfigService,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * O servidor da Evolution é compartilhado: um nome que já existe e não foi
   * criado por aqui é de outro sistema, e tomá-lo desligaria o WhatsApp dele.
   */
  instanceInUse(): ConflictException {
    return new ConflictException({
      code: 'WHATSAPP_INSTANCE_IN_USE',
      message: 'Nome de instância em uso. Escolha outro nome para a instância.',
    });
  }

  notConnected(): ConflictException {
    return new ConflictException({
      code: 'WHATSAPP_NOT_CONNECTED',
      message: 'Conecte um número do WhatsApp antes de usar o módulo.',
    });
  }

  /**
   * Origem pública desta API. Sai do API_PUBLIC_URL, não do APP_URL: em produção
   * o front e a API ficam em domínios diferentes e o webhook precisa chegar na
   * API.
   */
  private apiOrigin(): string {
    return (
      this.config.get<string>('API_PUBLIC_URL') ??
      this.config.get<string>('APP_URL') ??
      ''
    ).replace(/\/$/, '');
  }

  /** URL que o app da Meta deve chamar (Cloud API). */
  webhookUrl(): string {
    return `${this.apiOrigin()}/api/v1/integrations/whatsapp/webhook`;
  }

  /** URL que a instância da Evolution deve chamar; o segredo vai nela. */
  evolutionWebhookUrl(connectionId: Types.ObjectId, secret: string): string {
    return `${this.apiOrigin()}/api/v1/integrations/whatsapp/evolution/${String(
      connectionId,
    )}/${secret}`;
  }

  /** Saves (or replaces) the connection of the workspace. */
  async save(
    workspaceId: Types.ObjectId,
    userId: Types.ObjectId,
    dto: SaveWaConnectionDto,
  ): Promise<WaConnectionDocument> {
    const provider = dto.provider ?? DEFAULT_WA_PROVIDER;
    const set: Record<string, unknown> =
      provider === 'cloud'
        ? {
            provider,
            phoneNumberId: dto.phoneNumberId ?? null,
            wabaId: dto.wabaId ?? '',
            accessToken: this.secrets.encrypt(dto.accessToken ?? ''),
            appSecret: this.secrets.encrypt(dto.appSecret ?? ''),
            verifyToken: dto.verifyToken ?? '',
            baseUrl: '',
            instanceName: null,
            apiKey: '',
          }
        : {
            provider,
            baseUrl: (dto.baseUrl ?? '').replace(/\/$/, ''),
            apiKey: this.secrets.encrypt(dto.apiKey ?? ''),
            instanceName: dto.instanceName ?? null,
            phoneNumberId: null,
            wabaId: '',
            accessToken: '',
            appSecret: '',
            verifyToken: '',
          };

    const current = await this.model.findOne({ workspaceId }).exec();

    await this.requireFree(workspaceId, provider, dto);

    if (provider === 'evolution') {
      set.instanceOwned = await this.keepsOwnership(current, dto);
    } else {
      set.instanceOwned = false;
    }

    const connection = await this.model
      .findOneAndUpdate(
        { workspaceId },
        {
          $set: {
            ...set,
            displayPhone: dto.displayPhone ?? '',
            verifiedName: dto.verifiedName ?? '',
            status: 'pending',
            lastError: '',
            qrCode: '',
            qrCodeAt: null,
            disconnectedAt: null,
          },
          $setOnInsert: { createdBy: userId },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .select(WITH_SECRETS)
      .exec();

    if (!connection) {
      throw this.notConnected();
    }

    // The secret of the webhook is born with the connection and never shows up
    // again in plain text anywhere but inside the URL of the instance.
    if (provider === 'evolution') {
      const secret = randomBytes(WA_WEBHOOK_SECRET_BYTES).toString('hex');

      connection.webhookSecret = this.secrets.encrypt(secret);
      connection.webhookSecretHash = hashSecret(secret);
      await connection.save();
    }

    return connection;
  }

  /** Nothing of this connection may already answer for another workspace. */
  private async requireFree(
    workspaceId: Types.ObjectId,
    provider: string,
    dto: SaveWaConnectionDto,
  ): Promise<void> {
    const taken =
      provider === 'cloud'
        ? await this.model
            .findOne({ phoneNumberId: dto.phoneNumberId, workspaceId: { $ne: workspaceId } })
            .exec()
        : await this.model
            .findOne({
              baseUrl: (dto.baseUrl ?? '').replace(/\/$/, ''),
              instanceName: dto.instanceName,
              workspaceId: { $ne: workspaceId },
            })
            .exec();

    if (taken) {
      throw new ConflictException({
        code: 'WHATSAPP_NUMBER_IN_USE',
        message: 'Esta conexão já está ligada a outro workspace.',
      });
    }
  }

  /**
   * Se a conexão continua dona da instância depois deste save. Só o mesmo
   * servidor e o mesmo nome que já eram nossos seguem com a posse — trocar o
   * nome é começar de novo. E, para um nome novo, o servidor é consultado na
   * hora: se a instância já existe, ela é de outro sistema e o nome é recusado
   * aqui, enquanto o gestor ainda está com o campo na mão.
   */
  private async keepsOwnership(
    current: WaConnectionDocument | null,
    dto: SaveWaConnectionDto,
  ): Promise<boolean> {
    const baseUrl = (dto.baseUrl ?? '').replace(/\/$/, '');
    const same =
      current?.provider === 'evolution' &&
      current.baseUrl === baseUrl &&
      current.instanceName === (dto.instanceName ?? null);

    if (same && current.instanceOwned) {
      return true;
    }

    try {
      const taken = await this.providers.of('evolution').instanceExists({
        provider: 'evolution',
        phoneNumberId: '',
        wabaId: '',
        accessToken: '',
        baseUrl,
        apiKey: dto.apiKey ?? '',
        instanceName: dto.instanceName ?? '',
      });

      if (taken) {
        throw this.instanceInUse();
      }
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }

      // Servidor fora do ar ou chave errada não travam o cadastro: a conferência
      // que decide é a do Conectar, que roda antes de criar qualquer coisa.
      this.logger.warn(`Não foi possível conferir a instância: ${messageOf(error)}`);
    }

    return false;
  }

  /** Asks the provider about the number and records what came back. */
  async test(workspaceId: Types.ObjectId): Promise<WaConnectionDocument> {
    const found = await this.requireCredentials(workspaceId);
    const { connection, credentials } = found;

    try {
      const info = await this.providers.forCredentials(credentials).phoneInfo(credentials);

      connection.displayPhone = info?.displayPhone ?? connection.displayPhone;
      connection.verifiedName = info?.verifiedName ?? connection.verifiedName;
      connection.qualityRating = info?.qualityRating ?? '';
      connection.status = 'connected';
      connection.lastError = '';
    } catch (error) {
      connection.status = 'error';
      connection.lastError = error instanceof Error ? error.message : String(error);
      await connection.save();

      throw error;
    }

    await connection.save();
    await this.emitState(connection);

    return connection;
  }

  /**
   * Starts the pairing: creates the instance when it is not there yet, points
   * its webhook back here and answers the QR Code to be read.
   */
  async connect(workspaceId: Types.ObjectId): Promise<WaQrCodeResult> {
    const { connection } = await this.requireCredentials(workspaceId);

    if (!waCapabilities(connection.provider).qrCode) {
      throw new ConflictException({
        code: 'WHATSAPP_PROVIDER_UNSUPPORTED',
        message: 'Este provedor não é conectado por QR Code.',
      });
    }

    const webhookUrl = this.evolutionWebhookUrl(
      connection._id,
      this.requireWebhookSecret(connection),
    );

    try {
      const status = connection.instanceOwned
        ? // A instância é nossa: o webhook é reapontado (a URL pública pode ter
          // mudado) e o pareamento recomeça.
          await this.resume(connection, webhookUrl)
        : await this.claim(connection, webhookUrl);

      connection.lastError = '';
      await this.applyStatus(connection, status);
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }

      connection.status = 'error';
      connection.lastError = messageOf(error);
      await connection.save();

      throw error;
    }

    return this.qrResultOf(connection);
  }

  /**
   * Primeira conexão deste nome: a instância é criada e só então o módulo passa
   * a ser dono dela. Um nome que já existe no servidor pertence a outro sistema
   * e é recusado — nada de reapontar webhook nem desconectar o que não é nosso.
   */
  private async claim(
    connection: WaConnectionDocument,
    webhookUrl: string,
  ): Promise<WaInstanceStatus> {
    const { credentials } = this.withCredentials(connection);
    const provider = this.providers.forCredentials(credentials);

    if (await provider.instanceExists(credentials)) {
      throw this.instanceInUse();
    }

    const status = await provider
      .createInstance(credentials, webhookUrl)
      .catch(async (error: unknown) => {
        // Criar com nome repetido é o que a Evolution responde quando alguém
        // ganhou a corrida: a conferência de novo diz qual dos dois erros é.
        if (await provider.instanceExists(credentials).catch(() => false)) {
          throw this.instanceInUse();
        }

        throw error;
      });

    connection.instanceOwned = true;
    await connection.save();

    return status;
  }

  /** Instância já nossa: reaponta o webhook e pede o QR Code de novo. */
  private async resume(
    connection: WaConnectionDocument,
    webhookUrl: string,
  ): Promise<WaInstanceStatus> {
    const { credentials } = this.withCredentials(connection);
    const provider = this.providers.forCredentials(credentials);

    await provider.setWebhook(credentials, webhookUrl);

    return provider.connect(credentials);
  }

  /** Só a instância que este módulo criou pode ser mexida. */
  private requireOwnInstance(connection: WaConnectionDocument): void {
    if (connection.provider === 'evolution' && !connection.instanceOwned) {
      throw this.instanceInUse();
    }
  }

  /** QR Code the webhook last delivered, for the tab to keep showing. */
  async qrCode(workspaceId: Types.ObjectId): Promise<WaQrCodeResult> {
    const connection = await this.model.findOne({ workspaceId }).select(WITH_SECRETS).exec();

    if (!connection) {
      throw this.notConnected();
    }

    return this.qrResultOf(connection);
  }

  /** Drops the pairing; the number has to read a new QR Code to come back. */
  async disconnect(workspaceId: Types.ObjectId): Promise<WaConnectionDocument> {
    const { connection, credentials } = await this.requireCredentials(workspaceId);

    this.requireOwnInstance(connection);
    await this.providers.forCredentials(credentials).disconnect(credentials);

    connection.status = 'disconnected';
    connection.qrCode = '';
    connection.qrCodeAt = null;
    connection.disconnectedAt = new Date();
    await connection.save();
    await this.emitState(connection);

    return connection;
  }

  async restart(workspaceId: Types.ObjectId): Promise<WaConnectionDocument> {
    const { connection, credentials } = await this.requireCredentials(workspaceId);

    this.requireOwnInstance(connection);

    const status = await this.providers.forCredentials(credentials).restart(credentials);

    await this.applyStatus(connection, status);

    return connection;
  }

  async status(workspaceId: Types.ObjectId): Promise<WaConnectionStatusResult> {
    const connection = await this.model.findOne({ workspaceId }).exec();
    const provider = connection?.provider ?? DEFAULT_WA_PROVIDER;

    return {
      connection,
      webhookUrl: provider === 'cloud' ? this.webhookUrl() : '',
      capabilities: waCapabilities(provider),
    };
  }

  /** Connection of the workspace with the secrets decrypted. */
  async requireCredentials(workspaceId: Types.ObjectId): Promise<WaConnectionWithCredentials> {
    const connection = await this.model.findOne({ workspaceId }).select(WITH_SECRETS).exec();

    if (!connection) {
      throw this.notConnected();
    }

    return this.withCredentials(connection);
  }

  /** Connection the Cloud API webhook is about; null when the number is unknown. */
  async byPhoneNumberId(phoneNumberId: string): Promise<WaConnectionWithCredentials | null> {
    const connection = await this.model
      .findOne({ phoneNumberId, provider: 'cloud' })
      .select(WITH_SECRETS)
      .exec();

    if (!connection) {
      return null;
    }

    try {
      return this.withCredentials(connection);
    } catch {
      return null;
    }
  }

  /**
   * Connection the Evolution webhook is about. The id comes from the URL and the
   * secret of the URL is compared with the hash on the document, so a wrong
   * secret is indistinguishable from an unknown connection: both answer null.
   */
  async byWebhookSecret(
    connectionId: string,
    secret: string,
  ): Promise<WaConnectionWithCredentials | null> {
    if (!Types.ObjectId.isValid(connectionId)) {
      return null;
    }

    const connection = await this.model
      .findOne({ _id: new Types.ObjectId(connectionId), provider: 'evolution' })
      .select(WITH_SECRETS)
      .exec();

    if (!connection || !matchesSecret(connection.webhookSecretHash, secret)) {
      return null;
    }

    try {
      return this.withCredentials(connection);
    } catch {
      return null;
    }
  }

  /** True when some connection answers for this verify token (GET handshake). */
  async matchesVerifyToken(verifyToken: string): Promise<boolean> {
    return (await this.model.countDocuments({ verifyToken, provider: 'cloud' }).exec()) > 0;
  }

  /**
   * Instâncias da Evolution que o módulo criou, para o vigia conferir uma a
   * uma. O que não é nosso não é vigiado: o estado seria de outro sistema.
   */
  async evolutionConnections(): Promise<WaConnectionDocument[]> {
    return this.model
      .find({ provider: 'evolution', instanceOwned: true })
      .select(WITH_SECRETS)
      .exec();
  }

  async touch(connectionId: Types.ObjectId): Promise<void> {
    await this.model.updateOne({ _id: connectionId }, { $set: { lastEventAt: new Date() } }).exec();
  }

  /** State the Evolution webhook reported for the instance. */
  async applyState(
    connection: WaConnectionDocument,
    state: WaInstanceState,
  ): Promise<WaConnectionDocument> {
    await this.applyStatus(connection, {
      state,
      qrCode: null,
      displayPhone: '',
      verifiedName: '',
    });

    return connection;
  }

  /** QR Code the Evolution webhook delivered while the pairing is open. */
  async applyQrCode(connection: WaConnectionDocument, qrCode: string): Promise<void> {
    connection.qrCode = qrCode;
    connection.qrCodeAt = new Date();

    if (connection.status === 'connected') {
      connection.status = 'pending';
    }

    await connection.save();
    await this.emitState(connection, true);
  }

  /** Writes what the provider says about the instance onto the connection. */
  async applyStatus(connection: WaConnectionDocument, status: WaInstanceStatus): Promise<void> {
    const next = statusOfInstanceState(status.state);

    connection.status = next;
    connection.qrCode = status.qrCode ?? (status.state === 'open' ? '' : connection.qrCode);
    connection.qrCodeAt = status.qrCode ? new Date() : connection.qrCodeAt;

    if (status.displayPhone) {
      connection.displayPhone = status.displayPhone;
    }

    if (status.verifiedName) {
      connection.verifiedName = status.verifiedName;
    }

    if (next === 'connected') {
      connection.disconnectedAt = null;
      connection.qrCode = '';
      connection.qrCodeAt = null;
      connection.lastError = '';
    }

    if (next === 'disconnected') {
      // QR Code guardado de um pareamento que caiu já expirou: mostrá-lo faria
      // alguém ler um código morto. A Evolution manda outro ao reconectar.
      if (!status.qrCode) {
        connection.qrCode = '';
        connection.qrCodeAt = null;
      }

      connection.disconnectedAt = connection.disconnectedAt ?? new Date();
    }

    await connection.save();
    await this.emitState(connection, Boolean(connection.qrCode));
  }

  /** Tells the Central, in real time, where the connection stands. */
  async emitState(connection: WaConnectionDocument, hasQrCode = false): Promise<void> {
    await this.events.emitAsync(WA_CONNECTION_STATE, {
      workspaceId: connection.workspaceId,
      provider: connection.provider,
      status: connection.status,
      displayPhone: connection.displayPhone,
      verifiedName: connection.verifiedName,
      hasQrCode,
    } satisfies WaConnectionStateEvent);
  }

  /** Secret of the webhook in plain text; only the URL of the instance sees it. */
  requireWebhookSecret(connection: WaConnectionDocument): string {
    const secret = this.secrets.tryDecrypt(connection.webhookSecret);

    if (!secret) {
      throw this.unreadable();
    }

    return secret;
  }

  private qrResultOf(connection: WaConnectionDocument): WaQrCodeResult {
    return {
      qrCode: connection.qrCode || null,
      qrCodeAt: connection.qrCodeAt,
      status: connection.status,
      displayPhone: connection.displayPhone,
      verifiedName: connection.verifiedName,
      webhookUrl:
        connection.provider === 'evolution'
          ? this.evolutionWebhookUrl(connection._id, this.requireWebhookSecret(connection))
          : this.webhookUrl(),
    };
  }

  private withCredentials(connection: WaConnectionDocument): WaConnectionWithCredentials {
    if (connection.provider === 'cloud') {
      const accessToken = this.secrets.tryDecrypt(connection.accessToken);
      const appSecret = this.secrets.tryDecrypt(connection.appSecret);

      if (!accessToken || !appSecret) {
        throw this.unreadable();
      }

      return {
        connection,
        appSecret,
        credentials: {
          provider: 'cloud',
          phoneNumberId: connection.phoneNumberId ?? '',
          wabaId: connection.wabaId,
          accessToken,
          baseUrl: '',
          apiKey: '',
          instanceName: '',
        },
      };
    }

    const apiKey = this.secrets.tryDecrypt(connection.apiKey);

    if (!apiKey) {
      throw this.unreadable();
    }

    return {
      connection,
      appSecret: '',
      credentials: {
        provider: 'evolution',
        phoneNumberId: '',
        wabaId: '',
        accessToken: '',
        baseUrl: connection.baseUrl,
        apiKey,
        instanceName: connection.instanceName ?? '',
      },
    };
  }

  private unreadable(): NotFoundException {
    return new NotFoundException({
      code: 'WHATSAPP_CREDENTIALS_UNREADABLE',
      message: 'Não foi possível ler as credenciais do WhatsApp; salve a conexão de novo.',
    });
  }
}

function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

/** Compares the secret of the URL with the stored hash, in constant time. */
function matchesSecret(hash: string, secret: string): boolean {
  if (hash.length === 0 || secret.length === 0) {
    return false;
  }

  const expected = Buffer.from(hash, 'hex');
  const given = Buffer.from(hashSecret(secret), 'hex');

  return expected.length === given.length && timingSafeEqual(expected, given);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
