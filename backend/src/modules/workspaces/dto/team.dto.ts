import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsMongoId, IsOptional, IsString, Length } from 'class-validator';

export class CreateTeamDto {
  @ApiProperty({ example: 'Squad Produto' })
  @IsString()
  @Length(2, 80)
  name: string;

  @ApiPropertyOptional({ type: [String], description: 'Membros ativos do workspace.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsMongoId({ each: true })
  memberIds?: string[];
}

export class UpdateTeamDto extends PartialType(CreateTeamDto) {}
