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
 * O serviço de push recusou a assinatura VAPID: a inscrição nasceu com outro
 * par de chaves (o servidor trocou de chave, ou o deploy tem outra). Ela nunca
 * volta a funcionar, então sai do banco e o navegador se inscreve de novo na
 * próxima visita — sem isso o canal fica mudo para sempre.
 */
const STALE_KEY = [401, 403];

/** O que aconteceu com um dispositivo no envio, para a tela de ajustes. */
export interface PushDeliveryResult {
  /** Serviço de push do navegador (fcm.googleapis.com, wns2-…, …). */
  host: string;
  ok: boolean;
  statusCode: number | null;
  /** Vazio quando deu certo. */
  message: string;
}

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

  /**
   * Envio sob demanda para os dispositivos do próprio usuário, com o resultado
   * de cada um. É o que a tela de ajustes usa para dizer por que o aviso não
   * chega: sem isso a falha só existe no log do servidor.
   */
  async sendTest(userId: Types.ObjectId): Promise<PushDeliveryResult[]> {
    if (!this.ready) {
      return [];
    }

    const subscriptions = await this.model.find({ userId }).exec();
    const body = JSON.stringify({
      title: 'Azuos Env',
      body: 'Teste: as notificações deste dispositivo estão funcionando.',
      url: '/',
      tag: 'push-test',
    } satisfies PushPayload);
    const results: PushDeliveryResult[] = [];

    for (const subscription of subscriptions) {
      results.push(await this.deliver(subscription, body));
    }

    return results;
  }

  private async deliver(
    subscription: PushSubscriptionDocument,
    body: string,
  ): Promise<PushDeliveryResult> {
    const host = hostOf(subscription.endpoint);

    try {
      await sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        body,
      );

      return { host, ok: true, statusCode: 201, message: '' };
    } catch (error) {
      const status = error instanceof WebPushError ? error.statusCode : null;
      const detail = error instanceof Error ? error.message : String(error);

      if (status !== null && GONE.includes(status)) {
        await this.model.deleteOne({ _id: subscription._id }).exec();
        this.logger.log(`Inscrição de push expirada em ${host} (${status}): removida.`);

        return { host, ok: false, statusCode: status, message: 'Inscrição expirada no navegador.' };
      }

      if (status !== null && STALE_KEY.includes(status)) {
        await this.model.deleteOne({ _id: subscription._id }).exec();
        this.logger.error(
          `Push recusado em ${host} (${status}): a inscrição foi feita com outra VAPID_PUBLIC_KEY. ` +
            'Inscrição removida; confira as chaves VAPID deste deploy.',
        );

        return {
          host,
          ok: false,
          statusCode: status,
          message:
            'O serviço de push recusou a chave do servidor. Ligue as notificações de novo neste dispositivo.',
        };
      }

      this.logger.warn(`Falha ao enviar push para ${host} (${status ?? 'sem status'}): ${detail}`);

      return { host, ok: false, statusCode: status, message: detail };
    }
  }
}

/** O host identifica o serviço de push sem jogar o endpoint inteiro no log. */
function hostOf(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    return 'endpoint inválido';
  }
}
