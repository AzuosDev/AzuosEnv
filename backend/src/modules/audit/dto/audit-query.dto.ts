import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsMongoId, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto';
import { AUDIT_ACTIONS, AuditAction } from '../audit-fields';

export class AuditQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: AUDIT_ACTIONS })
  @IsOptional()
  @IsIn(AUDIT_ACTIONS)
  action?: AuditAction;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  actorId?: string;
}
