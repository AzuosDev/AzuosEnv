import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsOptional } from 'class-validator';

export class ImportClickUpDto {
  @ApiPropertyOptional({
    description: 'Space de destino; ausente usa o Space indicado em cada linha.',
  })
  @IsOptional()
  @IsMongoId()
  spaceId?: string;
}
