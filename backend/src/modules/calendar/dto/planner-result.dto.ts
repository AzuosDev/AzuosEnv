import { ApiProperty } from '@nestjs/swagger';
import { Task } from '../../tasks/schemas/task.schema';
import { CalendarEvent } from '../schemas/calendar-event.schema';

/** Resposta de GET /calendar/events. */
export class CalendarEventsDto {
  @ApiProperty({ type: [CalendarEvent] })
  items: CalendarEvent[];
}

/** Resposta de GET /me/planner: agenda, prazos do período e tarefas sem bloco. */
export class PlannerResultDto {
  @ApiProperty({ description: 'Começo do período em UTC ISO 8601.' })
  from: string;

  @ApiProperty({ description: 'Fim do período em UTC ISO 8601.' })
  to: string;

  @ApiProperty({ type: [CalendarEvent] })
  events: CalendarEvent[];

  @ApiProperty({ type: [Task], description: 'Tarefas minhas com prazo no período.' })
  dueTasks: Task[];

  @ApiProperty({ type: [Task], description: 'Tarefas minhas em aberto sem bloco de tempo.' })
  unscheduledTasks: Task[];
}
