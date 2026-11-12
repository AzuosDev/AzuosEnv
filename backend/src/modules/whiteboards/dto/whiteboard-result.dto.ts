import { ApiProperty } from '@nestjs/swagger';
import { Task } from '../../tasks/schemas/task.schema';
import { Whiteboard } from '../schemas/whiteboard.schema';

export class ElementTaskResultDto {
  @ApiProperty({ type: Task, description: 'Tarefa criada a partir do elemento.' })
  task: Task;

  @ApiProperty({ type: Whiteboard, description: 'Quadro com o elemento já ligado à tarefa.' })
  whiteboard: Whiteboard;

  @ApiProperty({ description: 'Elemento convertido.' })
  elementId: string;
}
