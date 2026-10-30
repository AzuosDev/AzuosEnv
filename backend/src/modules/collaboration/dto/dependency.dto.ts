import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsMongoId } from 'class-validator';
import { DEPENDENCY_TYPES, DependencyType } from '../collaboration-fields';

export class CreateDependencyDto {
  @ApiProperty({ description: 'Tarefa relacionada, por id.' })
  @IsMongoId()
  dependsOnId: string;

  @ApiProperty({ enum: DEPENDENCY_TYPES })
  @IsEnum(DEPENDENCY_TYPES)
  type: DependencyType;
}
