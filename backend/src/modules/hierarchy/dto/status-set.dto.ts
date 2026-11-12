import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsHexColor,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { STATUS_GROUPS, StatusGroup } from '../status-templates';

export class StatusDto {
  @ApiPropertyOptional({ description: 'Mantém o id de um status existente.' })
  @IsOptional()
  @IsMongoId()
  id?: string;

  @ApiProperty({ example: 'Em andamento' })
  @IsString()
  @Length(1, 60)
  name: string;

  @ApiProperty({ example: '#2563EB' })
  @IsHexColor()
  color: string;

  @ApiProperty({ enum: STATUS_GROUPS })
  @IsEnum(STATUS_GROUPS)
  group: StatusGroup;
}

export class CreateStatusSetDto {
  @ApiProperty({ example: 'Dev Azuos' })
  @IsString()
  @Length(1, 80)
  name: string;

  @ApiProperty({ type: [StatusDto], description: 'A ordem do array define a ordem dos statuses.' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => StatusDto)
  statuses: StatusDto[];
}

export class UpdateStatusSetDto extends PartialType(CreateStatusSetDto) {}
