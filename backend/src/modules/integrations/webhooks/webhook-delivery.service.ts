import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { SecretsService } from '../../secrets/secrets.service';
import {
  DELIVERY_HEADER,
  EVENT_HEADER,
  MAX_DELIVERY_ATTEMPTS,
  MAX_DELIVERY_BATCH,
  SIGNATURE_HEADER,
  OutgoingWebhookEvent,
  WEBHOOK_TIMEOUT_MS,
} from './webhook-fields';
import { backoffDelayMs, hasAttemptsLeft, signBody } from './webhook-signature';
import { OutgoingWebhook, OutgoingWebhookDocument } from './schemas/outgoing-webhook.schema';
import { WebhookDelivery, WebhookDeliveryDocument } from './schemas/webhook-delivery.schema';

/**
 * Sends the signed payload and keeps the log. The first attempt happens inside the
 * request that produced the event; the failures are retried by the cron until the
 * fifth attempt.
 */
@Injectable()
export class WebhookDeliveryService {
  private readonly logger = new Logger(WebhookDeliveryService.name);

  constructor(
    @InjectModel(OutgoingWebhook.name) private readonly webhooks: Model<OutgoingWebhook>,
    @InjectModel(WebhookDelivery.name) private readonly deliveries: Model<WebhookDelivery>,
    private readonly secrets: SecretsService,
  ) {}

  /** One delivery row per subscribed webhook, each tried right away. */
  async enqueue(
    workspaceId: Types.ObjectId,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<WebhookDeliveryDocument[]> {
    const query = this.webhooks.find({
      workspaceId,
      active: true,
      events: { $in: [event as OutgoingWebhookEvent, '*'] },
    });

    // `select` is called apart from the chain: Mongoose 9 narrows the document
    // type when the projection is chained.
    query.select('+secret');

    const subscribed = await query.exec();
    const created: WebhookDeliveryDocument[] = [];

    for (const webhook of subscribed) {
      const delivery = await this.deliveries.create({
        workspaceId,
        webhookId: webhook._id,
        event,
        payload,
        status: 'pending',
        attempts: 0,
      });

      created.push(await this.attempt(delivery, webhook));
    }

    return created;
  }

  /** Deliveries whose retry is due; public so the e2e does not wait for the cron. */
  async runPending(now: Date = new Date()): Promise<number> {
    const pending = await this.deliveries
      .find({
        status: 'pending',
        nextAttemptAt: { $ne: null, $lte: now },
        attempts: { $lt: MAX_DELIVERY_ATTEMPTS },
      })
      .sort({ nextAttemptAt: 1 })
      .limit(MAX_DELIVERY_BATCH)
      .exec();

    for (const delivery of pending) {
      const webhookQuery = this.webhooks.findOne({
        _id: delivery.webhookId,
        workspaceId: delivery.workspaceId,
      });

      webhookQuery.select('+secret');

      const webhook = await webhookQuery.exec();

      if (!webhook || !webhook.active) {
        delivery.status = 'failed';
        delivery.error = 'Webhook removido ou desativado.';
        delivery.nextAttemptAt = null;
        await delivery.save();
        continue;
      }

      await this.attempt(delivery, webhook);
    }

    return pending.length;
  }

  /** Single attempt; never throws, the outcome lives in the delivery row. */
  async attempt(
    delivery: WebhookDeliveryDocument,
    webhook: OutgoingWebhookDocument,
  ): Promise<WebhookDeliveryDocument> {
    const secret = this.secrets.tryDecrypt(webhook.secret);
    const body = JSON.stringify({
      event: delivery.event,
      deliveryId: String(delivery._id),
      workspaceId: String(delivery.workspaceId),
      at: new Date().toISOString(),
      data: delivery.payload,
    });

    delivery.attempts += 1;

    if (!secret) {
      return this.settleFailure(delivery, 'Não foi possível ler o secret do webhook.', null, false);
    }

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [EVENT_HEADER]: delivery.event,
          [DELIVERY_HEADER]: randomUUID(),
          [SIGNATURE_HEADER]: signBody(body, secret),
        },
        body,
        signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
      });

      if (!response.ok) {
        return this.settleFailure(
          delivery,
          `O destino respondeu ${response.status}.`,
          response.status,
          true,
        );
      }

      delivery.status = 'success';
      delivery.statusCode = response.status;
      delivery.error = null;
      delivery.nextAttemptAt = null;
      delivery.deliveredAt = new Date();
      await delivery.save();
      await this.webhooks
        .updateOne({ _id: webhook._id }, { $set: { lastDeliveryAt: delivery.deliveredAt } })
        .exec();

      return delivery;
    } catch (error) {
      return this.settleFailure(
        delivery,
        error instanceof Error ? error.message : String(error),
        null,
        true,
      );
    }
  }

  private async settleFailure(
    delivery: WebhookDeliveryDocument,
    error: string,
    statusCode: number | null,
    retryable: boolean,
  ): Promise<WebhookDeliveryDocument> {
    const retry = retryable && hasAttemptsLeft(delivery.attempts);

    delivery.status = retry ? 'pending' : 'failed';
    delivery.statusCode = statusCode;
    delivery.error = error;
    delivery.nextAttemptAt = retry
      ? new Date(Date.now() + backoffDelayMs(delivery.attempts))
      : null;

    await delivery.save();

    if (!retry) {
      this.logger.warn(
        `Entrega ${String(delivery._id)} de ${delivery.event} falhou em definitivo: ${error}`,
      );
    }

    return delivery;
  }
}
