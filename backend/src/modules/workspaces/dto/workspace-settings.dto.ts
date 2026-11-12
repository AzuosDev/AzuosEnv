import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, ValidateNested } from 'class-validator';

export class ClickAppsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  priority?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  tags?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  timeTracking?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  estimates?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  sprints?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  customFields?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  multipleLists?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  customIds?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ai?: boolean;
}

export class WorkspaceSettingsDto {
  @ApiPropertyOptional({ type: ClickAppsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ClickAppsDto)
  clickApps?: ClickAppsDto;
}
