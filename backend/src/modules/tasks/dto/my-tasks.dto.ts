import { ApiProperty } from '@nestjs/swagger';
import { Task } from '../schemas/task.schema';

/** As cinco seções de "Minhas tarefas", já no fuso de quem pediu. */
export class MyTasksSectionsDto {
  @ApiProperty({ type: [Task], description: 'Prazo já passou.' })
  overdue: Task[];

  @ApiProperty({ type: [Task], description: 'Prazo é hoje.' })
  today: Task[];

  @ApiProperty({ type: [Task], description: 'Prazo nos próximos sete dias.' })
  next7: Task[];

  @ApiProperty({ type: [Task], description: 'Prazo depois dos próximos sete dias.' })
  later: Task[];

  @ApiProperty({ type: [Task], description: 'Tarefa sem prazo.' })
  noDate: Task[];
}

/** Resultado de GET /my-tasks. */
export class MyTasksResultDto {
  @ApiProperty({ description: 'Fuso usado para montar as seções.', example: 'America/Sao_Paulo' })
  timezone: string;

  @ApiProperty({ type: MyTasksSectionsDto })
  sections: MyTasksSectionsDto;
}
