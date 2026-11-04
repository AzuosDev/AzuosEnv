import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsMongoId,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { TASK_PRIORITIES, TASK_TYPES, TaskPriority, TaskType } from '../../tasks/task-fields';
import {
  AI_AGENT_TYPES,
  AI_SUMMARIZE_ENTITY_TYPES,
  AI_WRITE_ACTIONS,
  AiAgentType,
  AiSummarizeEntityType,
  AiWriteAction,
  MAX_AI_AGENT_NAME_LENGTH,
  MAX_AI_PROMPT_LENGTH,
  MAX_AI_TEXT_LENGTH,
  MAX_CRON_LENGTH,
  MAX_PROPOSED_TASKS,
} from '../ai-fields';

export class AiChatDto {
  @ApiProperty({ example: 'Quais tarefas estão atrasadas?' })
  @IsString()
  @Length(1, MAX_AI_PROMPT_LENGTH)
  message: string;

  @ApiPropertyOptional({ description: 'Continua uma conversa existente.' })
  @IsOptional()
  @IsMongoId()
  conversationId?: string;
}

export class AiSummarizeDto {
  @ApiProperty({ enum: AI_SUMMARIZE_ENTITY_TYPES })
  @IsEnum(AI_SUMMARIZE_ENTITY_TYPES)
  entityType: AiSummarizeEntityType;

  @ApiProperty({ description: 'Id da tarefa, da mensagem raiz, do canal ou do Doc.' })
  @IsMongoId()
  id: string;

  @ApiPropertyOptional({ description: 'Pergunta extra sobre o conteúdo.' })
  @IsOptional()
  @IsString()
  @Length(1, MAX_AI_PROMPT_LENGTH)
  instruction?: string;
}

export class AiTasksFromTextDto {
  @ApiProperty({ example: 'Corrigir o fechamento de caixa e revisar o relatório até sexta.' })
  @IsString()
  @Length(1, MAX_AI_TEXT_LENGTH)
  text: string;

  @ApiProperty({ description: 'List onde as tarefas serão criadas no confirm.' })
  @IsMongoId()
  listId: string;
}

export class ProposedTaskDto {
  @ApiProperty()
  @IsString()
  @Length(1, 500)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 5000)
  descriptionText?: string;

  @ApiPropertyOptional({ enum: TASK_PRIORITIES })
  @IsOptional()
  @IsEnum(TASK_PRIORITIES)
  priority?: TaskPriority;

  @ApiPropertyOptional({ enum: TASK_TYPES })
  @IsOptional()
  @IsEnum(TASK_TYPES)
  type?: TaskType;

  @ApiPropertyOptional({ description: 'UTC ISO 8601.' })
  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  estimateMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  points?: number;
}

export class ConfirmTasksFromTextDto {
  @ApiProperty()
  @IsMongoId()
  listId: string;

  @ApiProperty({ type: [ProposedTaskDto], maxItems: MAX_PROPOSED_TASKS })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_PROPOSED_TASKS)
  @ValidateNested({ each: true })
  @Type(() => ProposedTaskDto)
  tasks: ProposedTaskDto[];
}

export class AiWriteDto {
  @ApiProperty({ enum: AI_WRITE_ACTIONS })
  @IsEnum(AI_WRITE_ACTIONS)
  action: AiWriteAction;

  @ApiProperty()
  @IsString()
  @Length(1, MAX_AI_TEXT_LENGTH)
  text: string;
}

export class CreateAiAgentDto {
  @ApiProperty({ example: 'Resumo diário' })
  @IsString()
  @Length(1, MAX_AI_AGENT_NAME_LENGTH)
  name: string;

  @ApiProperty({ enum: AI_AGENT_TYPES })
  @IsEnum(AI_AGENT_TYPES)
  type: AiAgentType;

  @ApiProperty({ example: '0 8 * * 1-5', description: 'Expressão cron.' })
  @IsString()
  @Length(1, MAX_CRON_LENGTH)
  cron: string;

  @ApiPropertyOptional({ description: '{ channelId?, userIds?, timezone? }' })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateAiAgentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, MAX_AI_AGENT_NAME_LENGTH)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, MAX_CRON_LENGTH)
  cron?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
