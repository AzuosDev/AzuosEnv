import { ApiProperty } from '@nestjs/swagger';
import { Task } from '../../tasks/schemas/task.schema';
import { AI_SUMMARIZE_ENTITY_TYPES, AI_WRITE_ACTIONS } from '../ai-fields';
import { ProposedTaskDto } from './ai.dto';

export class AiSummaryResultDto {
  @ApiProperty({ enum: AI_SUMMARIZE_ENTITY_TYPES })
  entityType: string;

  @ApiProperty({ description: 'Id da entidade resumida.' })
  id: string;

  @ApiProperty({ description: 'Resumo em markdown.' })
  summary: string;
}

export class AiTaskProposalResultDto {
  @ApiProperty({ description: 'List de destino da proposta.' })
  listId: string;

  @ApiProperty({ type: [ProposedTaskDto], description: 'Tarefas propostas; nada foi criado.' })
  tasks: ProposedTaskDto[];

  @ApiProperty({ type: [String], description: 'Avisos sobre o que a IA não aproveitou.' })
  warnings: string[];
}

export class AiConfirmResultDto {
  @ApiProperty({ description: 'List onde as tarefas foram criadas.' })
  listId: string;

  @ApiProperty({ type: [Task], description: 'Tarefas criadas.' })
  created: Task[];
}

export class AiWriteResultDto {
  @ApiProperty({ enum: AI_WRITE_ACTIONS })
  action: string;

  @ApiProperty({ description: 'Texto reescrito.' })
  text: string;
}

export class AiUsageSummaryDto {
  @ApiProperty({ description: 'Início do mês contabilizado (UTC ISO 8601).' })
  from: string;

  @ApiProperty()
  tokensIn: number;

  @ApiProperty()
  tokensOut: number;

  @ApiProperty()
  total: number;

  @ApiProperty({ description: 'Teto de tokens do mês; 0 é sem teto.' })
  budget: number;
}
