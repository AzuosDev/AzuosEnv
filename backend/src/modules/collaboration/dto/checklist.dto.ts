import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsMongoId, IsOptional, IsString, Length } from 'class-validator';

export class CreateChecklistDto {
  @ApiProperty({ example: 'Critérios de aceite' })
  @IsString()
  @Length(1, 200)
  name: string;
}

export class UpdateChecklistDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;
}

export class CreateChecklistItemDto {
  @ApiProperty({ example: 'Validar o fechamento com troco' })
  @IsString()
  @Length(1, 1000)
  text: string;

  @ApiPropertyOptional({ description: 'Membro ativo responsável pelo item.' })
  @IsOptional()
  @IsMongoId()
  assigneeId?: string | null;

  @ApiPropertyOptional({ description: 'Item pai; o subitem fica na mesma checklist.' })
  @IsOptional()
  @IsMongoId()
  parentItemId?: string | null;
}

export class UpdateChecklistItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  text?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  done?: boolean;

  @ApiPropertyOptional({ description: 'null remove o responsável.' })
  @IsOptional()
  @IsMongoId()
  assigneeId?: string | null;
}
