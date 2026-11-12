import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { MAX_GOAL_NAME_LENGTH, MAX_TARGET_TASKS, TARGET_TYPES, TargetType } from '../goals-fields';

export class CreateTargetDto {
  @ApiProperty({ example: 'Tarefas da sprint entregues' })
  @IsString()
  @Length(1, MAX_GOAL_NAME_LENGTH)
  name: string;

  @ApiProperty({ enum: TARGET_TYPES })
  @IsEnum(TARGET_TYPES)
  type: TargetType;

  @ApiPropertyOptional({ description: 'Ponto de partida do alvo; padrão 0.' })
  @IsOptional()
  @IsNumber()
  start?: number;

  @ApiPropertyOptional({ description: 'Obrigatório fora do tipo tasks, que conta as tarefas.' })
  @IsOptional()
  @IsNumber()
  target?: number;

  @ApiPropertyOptional({ description: 'Ignorado no tipo tasks; padrão 0.' })
  @IsOptional()
  @IsNumber()
  current?: number;

  @ApiPropertyOptional({ example: 'horas' })
  @IsOptional()
  @IsString()
  @Length(1, 40)
  unit?: string | null;

  @ApiPropertyOptional({ type: [String], description: 'Tarefas contadas no tipo tasks.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_TARGET_TASKS)
  @IsMongoId({ each: true })
  taskIds?: string[];

  @ApiPropertyOptional({ description: 'List inteira contada no tipo tasks.' })
  @IsOptional()
  @IsMongoId()
  listId?: string | null;
}

export class UpdateTargetDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, MAX_GOAL_NAME_LENGTH)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  start?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  target?: number;

  @ApiPropertyOptional({ description: 'Ignorado no tipo tasks.' })
  @IsOptional()
  @IsNumber()
  current?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 40)
  unit?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_TARGET_TASKS)
  @IsMongoId({ each: true })
  taskIds?: string[];

  @ApiPropertyOptional({ description: 'null solta a List do alvo.' })
  @IsOptional()
  @IsMongoId()
  listId?: string | null;
}
