import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Task } from '../schemas/task.schema';

/** Tarefa das views, com o resumo de subtarefas que a linha e o card mostram. */
export class TaskListItemDto extends Task {
  @ApiProperty({ description: 'Quantas subtarefas diretas a tarefa tem.' })
  subtaskCount: number;

  @ApiProperty({ description: 'Quantas dessas subtarefas estão concluídas ou fechadas.' })
  subtaskDoneCount: number;
}

/** Um grupo de GET /tasks/query quando groupBy não é `none`. */
export class TaskGroupDto {
  @ApiProperty({
    description: 'Chave do grupo: statusId, id do responsável, prioridade ou bucket de prazo.',
  })
  key: string;

  @ApiProperty({ description: 'Rótulo do grupo, já em português.' })
  label: string;

  @ApiProperty({ type: [TaskListItemDto] })
  items: TaskListItemDto[];

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Cursor do próximo lote deste grupo; null quando acabou.',
  })
  nextCursor: string | null;
}

/**
 * Resultado de GET /tasks/query: `items` + `nextCursor` quando groupBy é `none`
 * e `groups` nos outros casos.
 */
export class TaskQueryResultDto {
  @ApiPropertyOptional({
    type: [TaskListItemDto],
    description: 'Página plana; só com groupBy = none.',
  })
  items?: TaskListItemDto[];

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Cursor da próxima página; null na última.',
  })
  nextCursor?: string | null;

  @ApiPropertyOptional({ type: [TaskGroupDto], description: 'Grupos; só com groupBy ≠ none.' })
  groups?: TaskGroupDto[];
}

/** Tarefa que a alteração em lote não aplicou, com o motivo. */
export class BulkSkippedDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ description: 'Código do motivo, como TASK_NOT_FOUND ou FORBIDDEN.' })
  code: string;
}

export class BulkResultDto {
  @ApiProperty({ description: 'Quantas tarefas foram alteradas.' })
  updated: number;

  @ApiProperty({ type: [BulkSkippedDto] })
  skipped: BulkSkippedDto[];
}
