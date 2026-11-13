import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, ValidateNested } from 'class-validator';
import { NOTIFICATION_TYPES, NotificationType } from '../notification-fields';

export class NotificationChannelsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  inbox?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  email?: boolean;
}

/**
 * One optional entry per notification type. Declared field by field so the global
 * ValidationPipe can whitelist the payload.
 */
export class NotificationTypeSettingsDto implements Partial<Record<NotificationType, unknown>> {
  @ApiPropertyOptional({ type: NotificationChannelsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationChannelsDto)
  assigned?: NotificationChannelsDto;

  @ApiPropertyOptional({ type: NotificationChannelsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationChannelsDto)
  mentioned?: NotificationChannelsDto;

  @ApiPropertyOptional({ type: NotificationChannelsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationChannelsDto)
  commented?: NotificationChannelsDto;

  @ApiPropertyOptional({ type: NotificationChannelsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationChannelsDto)
  statusChanged?: NotificationChannelsDto;

  @ApiPropertyOptional({ type: NotificationChannelsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationChannelsDto)
  dueSoon?: NotificationChannelsDto;

  @ApiPropertyOptional({ type: NotificationChannelsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationChannelsDto)
  overdue?: NotificationChannelsDto;

  @ApiPropertyOptional({ type: NotificationChannelsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationChannelsDto)
  reminder?: NotificationChannelsDto;

  @ApiPropertyOptional({ type: NotificationChannelsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationChannelsDto)
  invited?: NotificationChannelsDto;

  @ApiPropertyOptional({ type: NotificationChannelsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationChannelsDto)
  commentAssigned?: NotificationChannelsDto;

  @ApiPropertyOptional({ type: NotificationChannelsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationChannelsDto)
  automation?: NotificationChannelsDto;

  @ApiPropertyOptional({ type: NotificationChannelsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationChannelsDto)
  chatMention?: NotificationChannelsDto;

  @ApiPropertyOptional({ type: NotificationChannelsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationChannelsDto)
  chatMessage?: NotificationChannelsDto;

  @ApiPropertyOptional({ type: NotificationChannelsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationChannelsDto)
  formSubmitted?: NotificationChannelsDto;

  @ApiPropertyOptional({ type: NotificationChannelsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationChannelsDto)
  aiSummary?: NotificationChannelsDto;

  @ApiPropertyOptional({ type: NotificationChannelsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationChannelsDto)
  whatsappMessage?: NotificationChannelsDto;

  @ApiPropertyOptional({ type: NotificationChannelsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationChannelsDto)
  whatsappAssigned?: NotificationChannelsDto;
}

export class UpdateNotificationSettingsDto {
  @ApiProperty({
    type: NotificationTypeSettingsDto,
    description: `Tipos: ${NOTIFICATION_TYPES.join(', ')}.`,
  })
  @ValidateNested()
  @Type(() => NotificationTypeSettingsDto)
  types: NotificationTypeSettingsDto;
}

/** Canais resolvidos de um tipo: o GET sempre devolve os dois. */
export class NotificationChannelsStateDto {
  @ApiProperty()
  inbox: boolean;

  @ApiProperty()
  email: boolean;
}

/** Preferências completas: um par de canais para cada tipo de notificação. */
export class NotificationPreferencesDto implements Record<
  NotificationType,
  NotificationChannelsStateDto
> {
  @ApiProperty({ type: NotificationChannelsStateDto })
  assigned: NotificationChannelsStateDto;

  @ApiProperty({ type: NotificationChannelsStateDto })
  mentioned: NotificationChannelsStateDto;

  @ApiProperty({ type: NotificationChannelsStateDto })
  commented: NotificationChannelsStateDto;

  @ApiProperty({ type: NotificationChannelsStateDto })
  statusChanged: NotificationChannelsStateDto;

  @ApiProperty({ type: NotificationChannelsStateDto })
  dueSoon: NotificationChannelsStateDto;

  @ApiProperty({ type: NotificationChannelsStateDto })
  overdue: NotificationChannelsStateDto;

  @ApiProperty({ type: NotificationChannelsStateDto })
  reminder: NotificationChannelsStateDto;

  @ApiProperty({ type: NotificationChannelsStateDto })
  invited: NotificationChannelsStateDto;

  @ApiProperty({ type: NotificationChannelsStateDto })
  commentAssigned: NotificationChannelsStateDto;

  @ApiProperty({ type: NotificationChannelsStateDto })
  automation: NotificationChannelsStateDto;

  @ApiProperty({ type: NotificationChannelsStateDto })
  chatMention: NotificationChannelsStateDto;

  @ApiProperty({ type: NotificationChannelsStateDto })
  chatMessage: NotificationChannelsStateDto;

  @ApiProperty({ type: NotificationChannelsStateDto })
  formSubmitted: NotificationChannelsStateDto;

  @ApiProperty({ type: NotificationChannelsStateDto })
  aiSummary: NotificationChannelsStateDto;

  @ApiProperty({ type: NotificationChannelsStateDto })
  whatsappMessage: NotificationChannelsStateDto;

  @ApiProperty({ type: NotificationChannelsStateDto })
  whatsappAssigned: NotificationChannelsStateDto;
}
