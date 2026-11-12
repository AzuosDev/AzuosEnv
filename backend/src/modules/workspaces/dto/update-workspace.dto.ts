import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';
import { CreateWorkspaceDto } from './create-workspace.dto';
import { WorkspaceSettingsDto } from './workspace-settings.dto';

export class UpdateWorkspaceDto extends PartialType(CreateWorkspaceDto) {
  @ApiPropertyOptional({ type: WorkspaceSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => WorkspaceSettingsDto)
  settings?: WorkspaceSettingsDto;
}
