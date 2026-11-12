import { ApiProperty } from '@nestjs/swagger';
import { Checklist } from '../../collaboration/schemas/checklist.schema';
import { TaskDependency } from '../../collaboration/schemas/task-dependency.schema';
import { CustomField } from '../../fields/schemas/custom-field.schema';
import { Task } from '../schemas/task.schema';

/** Quantos itens existem e quantos já estão prontos. */
export class ProgressDto {
  @ApiProperty({ description: 'Total de itens.' })
  total: number;

  @ApiProperty({ description: 'Itens concluídos.' })
  done: number;
}

/**
 * Resposta de GET /tasks/:idOrCustomId: a tarefa com o resumo de colaboração
 * que o painel abre de uma vez (checklists inteiras, contagens e campos).
 */
export class TaskDetailDto extends Task {
  @ApiProperty({ description: 'Subtarefas diretas.' })
  subtasks: ProgressDto;

  @ApiProperty({ type: [Checklist], description: 'Checklists da tarefa, em ordem manual.' })
  checklists: Checklist[];

  @ApiProperty({ description: 'Itens somados de todas as checklists.' })
  checklistItems: ProgressDto;

  @ApiProperty({ type: [TaskDependency], description: 'Dependências nos dois sentidos.' })
  dependencies: TaskDependency[];

  @ApiProperty({ description: 'Quantos anexos a tarefa tem.' })
  attachmentCount: number;

  @ApiProperty({ description: 'Quantos comentários não excluídos a tarefa tem.' })
  commentCount: number;

  @ApiProperty({ type: [CustomField], description: 'Campos personalizados válidos na List.' })
  fields: CustomField[];
}
