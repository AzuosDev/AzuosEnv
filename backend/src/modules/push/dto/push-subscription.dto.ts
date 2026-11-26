import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class PushSubscriptionKeysDto {
  @ApiProperty({ description: 'Chave pública do navegador (p256dh).' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  p256dh: string;

  @ApiProperty({ description: 'Segredo de autenticação do navegador.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  auth: string;
}

/** O que `pushManager.subscribe` devolve, no formato do PushSubscription JSON. */
export class CreatePushSubscriptionDto {
  @ApiProperty({ description: 'Endpoint do serviço de push do navegador.' })
  // O serviço de push do navegador é sempre https (FCM, Mozilla, WNS).
  @IsUrl({ require_tld: false, require_protocol: true, protocols: ['https'] })
  @MaxLength(2000)
  endpoint: string;

  @ApiProperty({ type: PushSubscriptionKeysDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys: PushSubscriptionKeysDto;

  @ApiPropertyOptional({ description: 'Identificação do dispositivo, para a tela de ajustes.' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  userAgent?: string;
}

export class PushSubscriptionResultDto {
  @ApiProperty({ description: 'Id da inscrição guardada.' })
  id: string;
}

export class PushPublicKeyDto {
  @ApiProperty({
    description: 'Chave pública VAPID; vazia quando o push não está configurado no servidor.',
  })
  publicKey: string;
}

/** Resultado do envio de teste em um dispositivo do usuário. */
export class PushDeliveryResultDto {
  @ApiProperty({ description: 'Serviço de push do navegador (fcm.googleapis.com, wns2-…).' })
  host: string;

  @ApiProperty({ description: 'O serviço de push aceitou o aviso.' })
  ok: boolean;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: 'Status devolvido pelo serviço de push; nulo quando a falha foi antes do envio.',
  })
  statusCode: number | null;

  @ApiProperty({ description: 'Motivo da falha; vazio quando deu certo.' })
  message: string;
}

export class PushTestResultDto {
  @ApiProperty({ description: 'O servidor tem chaves VAPID configuradas.' })
  configured: boolean;

  @ApiProperty({ type: [PushDeliveryResultDto], description: 'Um resultado por dispositivo.' })
  results: PushDeliveryResultDto[];
}
