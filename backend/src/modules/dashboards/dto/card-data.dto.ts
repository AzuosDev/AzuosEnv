import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { STATUS_GROUPS, StatusGroup } from '../../hierarchy/status-templates';
import { TASK_PRIORITIES, TaskPriority } from '../../tasks/task-fields';
import { CARD_TYPES, CardType } from '../dashboard-cards';

/** One slice of the tasksByStatus card. */
export class CardStatusSliceDto {
  @ApiProperty()
  statusId: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: STATUS_GROUPS, nullable: true })
  group: StatusGroup | null;

  @ApiProperty()
  position: number;

  @ApiProperty()
  count: number;
}

export class CardTasksByStatusDto {
  @ApiProperty({ type: [CardStatusSliceDto] })
  items: CardStatusSliceDto[];

  @ApiProperty()
  total: number;
}

/** One slice of the tasksByAssignee card; userId null é "Sem responsável". */
export class CardAssigneeSliceDto {
  @ApiProperty({ nullable: true, type: String })
  userId: string | null;

  @ApiProperty()
  name: string;

  @ApiProperty()
  count: number;
}

export class CardTasksByAssigneeDto {
  @ApiProperty({ type: [CardAssigneeSliceDto] })
  items: CardAssigneeSliceDto[];

  @ApiProperty()
  total: number;
}

/** Série do burndown: o que falta por dia e a linha ideal. */
export class CardBurndownDto {
  @ApiProperty({ type: [String] })
  days: string[];

  @ApiProperty()
  total: number;

  @ApiProperty({ type: [Number] })
  remaining: number[];

  @ApiProperty({ type: [Number] })
  ideal: number[];
}

/** Série do burnup: escopo e concluído acumulados por dia. */
export class CardBurnupDto {
  @ApiProperty({ type: [String] })
  days: string[];

  @ApiProperty({ type: [Number] })
  scope: number[];

  @ApiProperty({ type: [Number] })
  completed: number[];
}

export class CardTimeByClientRowDto {
  @ApiProperty()
  client: string;

  @ApiProperty()
  minutes: number;

  @ApiProperty()
  billableMinutes: number;

  @ApiProperty()
  hours: number;
}

export class CardTimeByClientDto {
  @ApiProperty({ type: [CardTimeByClientRowDto] })
  items: CardTimeByClientRowDto[];

  @ApiProperty()
  totalMinutes: number;
}

export class CardTimeByUserRowDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  minutes: number;

  @ApiProperty()
  billableMinutes: number;

  @ApiProperty()
  hours: number;
}

export class CardTimeByUserDto {
  @ApiProperty({ type: [CardTimeByUserRowDto] })
  items: CardTimeByUserRowDto[];

  @ApiProperty()
  totalMinutes: number;
}

export class CardBillableDto {
  @ApiProperty()
  totalMinutes: number;

  @ApiProperty()
  billableMinutes: number;

  @ApiProperty()
  nonBillableMinutes: number;

  @ApiProperty()
  billableHours: number;

  @ApiProperty()
  totalHours: number;

  @ApiProperty({ description: 'Percentual inteiro de 0 a 100.' })
  billablePercent: number;
}

/** Linha dos cards de lista (atrasadas e tabela). */
export class CardTaskRowDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  customId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  status: string;

  @ApiProperty({ enum: STATUS_GROUPS })
  statusGroup: StatusGroup;

  @ApiProperty({ enum: TASK_PRIORITIES, nullable: true })
  priority: TaskPriority | null;

  @ApiProperty({ type: [String], description: 'Nomes dos responsáveis.' })
  assignees: string[];

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  dueAt: string | null;

  @ApiProperty({ nullable: true, type: Number })
  points: number | null;

  @ApiProperty({ nullable: true, type: Number })
  estimateMinutes: number | null;

  @ApiProperty()
  trackedMinutes: number;
}

export class CardTaskListDto {
  @ApiProperty({ description: 'Total que casa com o recorte, antes do limite.' })
  total: number;

  @ApiProperty({ type: [CardTaskRowDto] })
  items: CardTaskRowDto[];
}

export class CardCalculatorDto {
  @ApiProperty({ example: 'sum' })
  op: string;

  @ApiProperty({ description: 'Campo da tarefa ou id do campo personalizado.' })
  field: string;

  @ApiProperty({ description: 'Tarefas que entraram na conta.' })
  count: number;

  @ApiProperty()
  value: number;
}

/**
 * Resposta de POST /cards/:cardId/data. `data` muda com o tipo do card; os
 * modelos CardTasksByStatusDto, CardTasksByAssigneeDto, WorkloadResultDto,
 * CardBurndownDto, CardBurnupDto, CardTimeByClientDto, CardTimeByUserDto,
 * CardBillableDto, CardTaskListDto e CardCalculatorDto descrevem cada forma.
 */
export class CardDataResponseDto {
  @ApiProperty()
  cardId: string;

  @ApiProperty({ enum: CARD_TYPES })
  type: CardType;

  @ApiProperty({ type: 'object', additionalProperties: true })
  data: Record<string, unknown>;
}

/** Só para o contrato enxergar os tipos de dado possíveis do card. */
export class CardDataShapesDto {
  @ApiPropertyOptional({ type: CardTasksByStatusDto })
  tasksByStatus?: CardTasksByStatusDto;

  @ApiPropertyOptional({ type: CardTasksByAssigneeDto })
  tasksByAssignee?: CardTasksByAssigneeDto;

  @ApiPropertyOptional({ type: CardBurndownDto })
  burndown?: CardBurndownDto;

  @ApiPropertyOptional({ type: CardBurnupDto })
  burnup?: CardBurnupDto;

  @ApiPropertyOptional({ type: CardTimeByClientDto })
  timeByClient?: CardTimeByClientDto;

  @ApiPropertyOptional({ type: CardTimeByUserDto })
  timeByUser?: CardTimeByUserDto;

  @ApiPropertyOptional({ type: CardBillableDto })
  billable?: CardBillableDto;

  @ApiPropertyOptional({ type: CardTaskListDto })
  taskList?: CardTaskListDto;

  @ApiPropertyOptional({ type: CardCalculatorDto })
  calculator?: CardCalculatorDto;
}
