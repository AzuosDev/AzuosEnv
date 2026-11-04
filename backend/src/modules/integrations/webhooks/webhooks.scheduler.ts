import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WebhookDeliveryService } from './webhook-delivery.service';

/** Retries the deliveries whose backoff is due. */
@Injectable()
export class WebhooksScheduler {
  private readonly logger = new Logger(WebhooksScheduler.name);

  constructor(private readonly deliveries: WebhookDeliveryService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async run(): Promise<void> {
    try {
      await this.deliveries.runPending();
    } catch (error) {
      this.logger.error(
        'Falha no ciclo de reentrega dos webhooks.',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
