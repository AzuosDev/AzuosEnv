import { ApiProperty } from '@nestjs/swagger';
import { List } from '../../hierarchy/schemas/list.schema';
import { SprintFolder } from '../schemas/sprint-folder.schema';

/** Pasta de sprints com as sprints (Lists) em ordem de início. */
export class SprintFolderViewDto {
  @ApiProperty({ type: SprintFolder })
  sprintFolder: SprintFolder;

  @ApiProperty({ type: [List] })
  sprints: List[];
}

/** Resposta de POST /sprints/:sprintId/close. */
export class CloseSprintResultDto {
  @ApiProperty({ type: List, description: 'Sprint fechada.' })
  sprint: List;

  @ApiProperty({ type: List, description: 'Sprint que recebeu as pendências.' })
  nextSprint: List;

  @ApiProperty({ description: 'Tarefas movidas para a próxima sprint.' })
  moved: number;
}
