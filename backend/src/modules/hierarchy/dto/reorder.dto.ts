import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsOptional } from 'class-validator';

/** Place the item between two siblings; omit both to send it to the end. */
export class ReorderDto {
  @ApiPropertyOptional({ description: 'Irmão que fica antes do item.' })
  @IsOptional()
  @IsMongoId()
  previousId?: string;

  @ApiPropertyOptional({ description: 'Irmão que fica depois do item.' })
  @IsOptional()
  @IsMongoId()
  nextId?: string;
}
