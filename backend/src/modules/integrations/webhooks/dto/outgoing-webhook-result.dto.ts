import { ApiProperty } from '@nestjs/swagger';
import { OutgoingWebhook } from '../schemas/outgoing-webhook.schema';

export class OutgoingWebhookResultDto {
  @ApiProperty({ type: OutgoingWebhook, description: 'Webhook de saída.' })
  webhook: OutgoingWebhook;

  @ApiProperty({
    nullable: true,
    description: 'Secret em claro; só aparece quando é gerado ou trocado.',
    example: 'a1b2c3',
  })
  secret: string | null;
}

export class OutgoingWebhooksResultDto {
  @ApiProperty({ type: [OutgoingWebhook], description: 'Webhooks do workspace.' })
  items: OutgoingWebhook[];
}
