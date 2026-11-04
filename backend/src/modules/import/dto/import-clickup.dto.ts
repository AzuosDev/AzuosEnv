import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

export class ImportClickUpDto {
  @ApiProperty({ description: 'Space que recebe as Lists e tarefas importadas.' })
  @IsMongoId()
  spaceId: string;
}
