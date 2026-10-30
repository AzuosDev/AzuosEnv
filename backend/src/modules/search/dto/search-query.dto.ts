import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { ToStringArray } from '../../../common/utils/query-array';
import {
  MAX_SEARCH_RESULTS,
  MAX_SEARCH_TERM_LENGTH,
  SEARCH_TYPES,
  SearchType,
} from '../search-fields';

export class SearchQueryDto {
  @ApiProperty({ description: 'Texto ou prefixo de customId (ex.: AZD-14).' })
  @IsString()
  @Length(1, MAX_SEARCH_TERM_LENGTH)
  q: string;

  @ApiPropertyOptional({
    enum: SEARCH_TYPES,
    isArray: true,
    description: 'Lista separada por vírgula; ausente busca em todos.',
  })
  @IsOptional()
  @ToStringArray()
  @IsIn(SEARCH_TYPES, { each: true })
  types?: SearchType[];

  @ApiPropertyOptional({ default: MAX_SEARCH_RESULTS, maximum: MAX_SEARCH_RESULTS })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_SEARCH_RESULTS)
  limit?: number;
}
