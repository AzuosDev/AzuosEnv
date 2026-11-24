import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WebPushError, sendNotification, setVapidDetails } from 'web-push';
import { CreatePushSubscriptionDto } from './dto/push-subscription.dto';
import { PushSubscription, PushSubscriptionDocument } from './schemas/push-subscription.schema';

/** O que o service worker recebe e desenha como notificação do sistema. */
export interface PushPayload {
  title: string;
  body: string;
  /** Caminho aberto no clique, relativo ao app. */
  url: string;
  /** Agrupa notificações do mesmo assunto no lugar de empilhar. */
  tag?: string;
}

/** Endpoint que o navegador descartou: a inscrição morreu e sai do banco. */
const GONE = [404, 410];

/**
 * Web Push padrão (VAPID): enviar é um POST para o serviço do navegador, então
 * funciona em host serverless, sem processo longo nem socket. Sem as chaves
 * VAPID o serviço fica desligado e só registra aviso.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly publicVapidKey: string;
  private readonly ready: boolean;

  constructor(
    @InjectModel(PushSubscription.name) private readonly model: Model<PushSubscription>,
    config: ConfigService,
  ) {
    this.publicVapidKey = config.get<string>('VAPID_PUBLIC_KEY') ?? '';

    const privateKey = config.get<string>('VAPID_PRIVATE_KEY') ?? '';

    this.ready = this.publicVapidKey !== '' && privateKey !== '';

    if (this.ready) {
      setVapidDetails(
        config.get<string>('VAPID_SUBJECT') || 'mailto:no-reply@azuos.dev',
        this.publicVapidKey,
        privateKey,
      );
    }
  }

  /** Vazia quando o servidor não tem push: o front esconde a opção. */
  get publicKey(): string {
    return this.ready ? this.publicVapidKey : '';
  }

  /** O endpoint é a identidade: reinscrever o mesmo dispositivo não duplica. */
  async subscribe(
    userId: Types.ObjectId,
    dto: CreatePushSubscriptionDto,
  ): Promise<PushSubscriptionDocument> {
    await this.model
      .updateOne(
        { endpoint: dto.endpoint },
        {
          $set: {
            userId,
            p256dh: dto.keys.p256dh,
            auth: dto.keys.auth,
            userAgent: dto.userAgent ?? '',
          },
        },
        { upsert: true },
      )
      .exec();

    return this.model.findOne({ endpoint: dto.endpoint }).orFail().exec();
  }

  /** Só apaga inscrição do próprio usuário; endpoint de outro não é encontrado. */
  async unsubscribe(userId: Types.ObjectId, endpoint: string): Promise<void> {
    await this.model.deleteOne({ userId, endpoint }).exec();
  }

  async forUser(userId: Types.ObjectId): Promise<PushSubscriptionDocument[]> {
    return this.model.find({ userId }).exec();
  }

  /**
   * Manda o aviso para todos os dispositivos dos usuários. Nunca lança: a
   * notificação não pode derrubar a escrita que a originou.
   */
  async sendToUsers(userIds: Types.ObjectId[], payload: PushPayload): Promise<void> {
    if (!this.ready || userIds.length === 0) {
      return;
    }

    const subscriptions = await this.model.find({ userId: { $in: userIds } }).exec();
    const body = JSON.stringify(payload);

    for (const subscription of subscriptions) {
      await this.deliver(subscription, body);
    }
  }

  private async deliver(subscription: PushSubscriptionDocument, body: string): Promise<void> {
    try {
      await sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        body,
      );
    } catch (error) {
      if (error instanceof WebPushError && GONE.includes(error.statusCode)) {
        await this.model.deleteOne({ _id: subscription._id }).exec();

        return;
      }

      this.logger.warn(
        `Falha ao enviar push para ${subscription.endpoint}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
