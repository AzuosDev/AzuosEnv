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
