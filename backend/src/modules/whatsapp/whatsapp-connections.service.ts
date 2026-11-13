import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SecretsService } from '../secrets/secrets.service';
import { WaCredentials, WhatsappGraphProvider } from './graph/whatsapp-graph.provider';
import { WaConnection, WaConnectionDocument } from './schemas/wa-connection.schema';
import { SaveWaConnectionDto } from './dto/whatsapp.dto';

export interface WaConnectionStatusResult {
  connection: WaConnectionDocument | null;
  /** URL the app of Meta must call. */
  webhookUrl: string;
}

/** Connection plus the credentials ready to use. */
export interface WaConnectionWithCredentials {
  connection: WaConnectionDocument;
  credentials: WaCredentials;
  appSecret: string;
}

/**
 * The number of the Cloud API of each workspace. The access token and the app
 * secret are stored encrypted and only leave here as credentials of a call.
 */
@Injectable()
export class WhatsappConnectionsService {
  constructor(
    @InjectModel(WaConnection.name) private readonly model: Model<WaConnection>,
    private readonly graph: WhatsappGraphProvider,
    private readonly secrets: SecretsService,
    private readonly config: ConfigService,
  ) {}

  notConnected(): ConflictException {
    return new ConflictException({
      code: 'WHATSAPP_NOT_CONNECTED',
      message: 'Conecte um número do WhatsApp antes de usar o módulo.',
    });
  }

  webhookUrl(): string {
    const base = (this.config.get<string>('APP_URL') ?? '').replace(/\/$/, '');

    return `${base}/api/v1/integrations/whatsapp/webhook`;
  }

  /** Saves (or replaces) the connection of the workspace. */
  async save(
    workspaceId: Types.ObjectId,
    userId: Types.ObjectId,
    dto: SaveWaConnectionDto,
  ): Promise<WaConnectionDocument> {
    const taken = await this.model
      .findOne({ phoneNumberId: dto.phoneNumberId, workspaceId: { $ne: workspaceId } })
      .exec();

    if (taken) {
      throw new ConflictException({
        code: 'WHATSAPP_NUMBER_IN_USE',
        message: 'Este número já está ligado a outro workspace.',
      });
    }

    const connection = await this.model
      .findOneAndUpdate(
        { workspaceId },
        {
          $set: {
            phoneNumberId: dto.phoneNumberId,
            wabaId: dto.wabaId,
            accessToken: this.secrets.encrypt(dto.accessToken),
            appSecret: this.secrets.encrypt(dto.appSecret),
            verifyToken: dto.verifyToken,
            displayPhone: dto.displayPhone ?? '',
            verifiedName: dto.verifiedName ?? '',
            status: 'pending',
            lastError: '',
          },
          $setOnInsert: { createdBy: userId },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();

    if (!connection) {
      throw this.notConnected();
    }

    return connection;
  }

  /** Calls the Graph API and records what came back about the number. */
  async test(workspaceId: Types.ObjectId): Promise<WaConnectionDocument> {
    const { connection, credentials } = await this.requireCredentials(workspaceId);

    try {
      const info = await this.graph.phoneInfo(credentials);

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

    return connection;
  }

  async status(workspaceId: Types.ObjectId): Promise<WaConnectionStatusResult> {
    return {
      connection: await this.model.findOne({ workspaceId }).exec(),
      webhookUrl: this.webhookUrl(),
    };
  }

  /** Connection of the workspace with the secrets decrypted. */
  async requireCredentials(workspaceId: Types.ObjectId): Promise<WaConnectionWithCredentials> {
    const query = this.model.findOne({ workspaceId });

    query.select('+accessToken +appSecret');

    const connection = await query.exec();

    if (!connection) {
      throw this.notConnected();
    }

    return this.withCredentials(connection);
  }

  /** Connection the webhook is about; null when the number is unknown here. */
  async byPhoneNumberId(phoneNumberId: string): Promise<WaConnectionWithCredentials | null> {
    const query = this.model.findOne({ phoneNumberId });

    query.select('+accessToken +appSecret');

    const connection = await query.exec();

    if (!connection) {
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
    return (await this.model.countDocuments({ verifyToken }).exec()) > 0;
  }

  async touch(connectionId: Types.ObjectId): Promise<void> {
    await this.model.updateOne({ _id: connectionId }, { $set: { lastEventAt: new Date() } }).exec();
  }

  private withCredentials(connection: WaConnectionDocument): WaConnectionWithCredentials {
    const accessToken = this.secrets.tryDecrypt(connection.accessToken);
    const appSecret = this.secrets.tryDecrypt(connection.appSecret);

    if (!accessToken || !appSecret) {
      throw new NotFoundException({
        code: 'WHATSAPP_CREDENTIALS_UNREADABLE',
        message: 'Não foi possível ler as credenciais do WhatsApp; salve a conexão de novo.',
      });
    }

    return {
      connection,
      appSecret,
      credentials: {
        phoneNumberId: connection.phoneNumberId,
        wabaId: connection.wabaId,
        accessToken,
      },
    };
  }
}
