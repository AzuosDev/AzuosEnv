import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsMongoId, IsString, Matches } from 'class-validator';
import { DEPENDENCY_TYPES, DependencyType } from '../collaboration-fields';

export class CreateDependencyDto {
  @ApiProperty({ description: 'Tarefa relacionada, por id.' })
  @IsMongoId()
  dependsOnId: string;

  @ApiProperty({ enum: DEPENDENCY_TYPES })
  @IsEnum(DEPENDENCY_TYPES)
  type: DependencyType;
}

/** Teto de tarefas por consulta em lote: o Gantt pede só o que está na tela. */
export const MAX_DEPENDENCY_TASK_IDS = 300;

export class DependenciesQueryDto {
  @ApiProperty({
    description: `Ids das tarefas separados por vírgula (até ${String(MAX_DEPENDENCY_TASK_IDS)}).`,
    example: '6711f0a1b2c3d4e5f6a7b8c9,6711f0a1b2c3d4e5f6a7b8ca',
  })
  @IsString()
  @Matches(/^[0-9a-fA-F]{24}(,[0-9a-fA-F]{24})*$/, {
    message: 'Use ids de tarefa separados por vírgula.',
  })
  taskIds: string;
}
