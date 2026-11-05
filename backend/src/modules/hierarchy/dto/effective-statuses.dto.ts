import { ApiProperty } from '@nestjs/swagger';
import { STATUS_GROUPS, StatusGroup } from '../status-templates';

export class EffectiveStatusDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Em andamento' })
  name: string;

  @ApiProperty({ example: '#2563EB' })
  color: string;

  @ApiProperty({ enum: STATUS_GROUPS })
  group: StatusGroup;

  @ApiProperty({ description: 'Ordem do status dentro do conjunto.' })
  position: number;
}

/** Statuses que valem para a List, com a origem na hierarquia. */
export class EffectiveStatusesDto {
  @ApiProperty()
  statusSetId: string;

  @ApiProperty({ example: 'Dev Azuos' })
  name: string;

  @ApiProperty({ enum: ['list', 'folder', 'space'], description: 'De onde vêm os statuses.' })
  source: 'list' | 'folder' | 'space';

  @ApiProperty({ type: [EffectiveStatusDto] })
  statuses: EffectiveStatusDto[];
}
