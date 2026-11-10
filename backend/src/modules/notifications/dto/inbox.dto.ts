import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto';
import { INBOX_TABS, InboxTab } from '../notification-fields';

export class InboxQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: INBOX_TABS, default: 'primary' })
  @IsOptional()
  @IsEnum(INBOX_TABS)
  tab?: InboxTab;
}

export class SnoozeNotificationDto {
  @ApiProperty({ description: 'Momento em que a notificação volta para a caixa de entrada.' })
  @IsDateString()
  until: string;
}

/** Resultado de POST /inbox/read-all. */
export class ReadAllResultDto {
  @ApiProperty({ description: 'Quantas notificações saíram de não lidas.', example: 7 })
  updated: number;
}
