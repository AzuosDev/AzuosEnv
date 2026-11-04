import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, Length } from 'class-validator';

export class SubmitFormDto {
  @ApiProperty({ description: 'Respostas por id de campo.' })
  @IsObject()
  values: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Campo honeypot: precisa chegar vazio, senão o envio é recusado.',
  })
  @IsOptional()
  @IsString()
  @Length(0, 200)
  website?: string;
}
