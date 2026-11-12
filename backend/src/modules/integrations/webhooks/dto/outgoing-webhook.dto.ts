import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsBoolean, IsEnum, IsOptional, IsUrl } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/pagination/pagination-query.dto';
import { OUTGOING_WEBHOOK_EVENTS, OutgoingWebhookEvent } from '../webhook-fields';

const URL_OPTIONS = { protocols: ['http', 'https'], require_protocol: true, require_tld: false };

export class CreateOutgoingWebhookDto {
  @ApiProperty({ example: 'https://hooks.azuos.dev/env' })
  @IsUrl(URL_OPTIONS)
  url: string;

  @ApiProperty({ enum: OUTGOING_WEBHOOK_EVENTS, isArray: true })
  @IsEnum(OUTGOING_WEBHOOK_EVENTS, { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(OUTGOING_WEBHOOK_EVENTS.length)
  events: OutgoingWebhookEvent[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateOutgoingWebhookDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl(URL_OPTIONS)
  url?: string;

  @ApiPropertyOptional({ enum: OUTGOING_WEBHOOK_EVENTS, isArray: true })
  @IsOptional()
  @IsEnum(OUTGOING_WEBHOOK_EVENTS, { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(OUTGOING_WEBHOOK_EVENTS.length)
  events?: OutgoingWebhookEvent[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ description: 'true gera um secret novo, devolvido uma única vez.' })
  @IsOptional()
  @IsBoolean()
  rotateSecret?: boolean;
}

export class DeliveryQueryDto extends PaginationQueryDto {}
