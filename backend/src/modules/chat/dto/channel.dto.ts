import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto';
import {
  CHANNEL_LOCATION_TYPES,
  ChannelLocationType,
  MAX_CHANNEL_MEMBERS,
  MAX_CHANNEL_NAME_LENGTH,
} from '../chat-fields';

/** Types accepted on creation; a DM is created only by the get-or-create route. */
export const CREATABLE_CHANNEL_TYPES = ['channel', 'group'] as const;
export type CreatableChannelType = (typeof CREATABLE_CHANNEL_TYPES)[number];

export class CreateChannelDto {
  @ApiPropertyOptional({ enum: CREATABLE_CHANNEL_TYPES, default: 'channel' })
  @IsOptional()
  @IsEnum(CREATABLE_CHANNEL_TYPES)
  type?: CreatableChannelType;

  @ApiProperty({ example: 'uSolutionsPDV' })
  @IsString()
  @Length(1, MAX_CHANNEL_NAME_LENGTH)
  name: string;

  @ApiPropertyOptional({ enum: CHANNEL_LOCATION_TYPES, default: 'workspace' })
  @IsOptional()
  @IsEnum(CHANNEL_LOCATION_TYPES)
  locationType?: ChannelLocationType;

  @ApiPropertyOptional({ description: 'Obrigatório fora de locationType workspace.' })
  @IsOptional()
  @IsMongoId()
  locationId?: string;

  @ApiPropertyOptional({ default: false, description: 'Visível apenas para os membros.' })
  @IsOptional()
  @IsBoolean()
  private?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_CHANNEL_MEMBERS)
  @IsMongoId({ each: true })
  memberIds?: string[];
}

export class UpdateChannelDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, MAX_CHANNEL_NAME_LENGTH)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  private?: boolean;
}

export class ChannelQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CHANNEL_LOCATION_TYPES })
  @IsOptional()
  @IsEnum(CHANNEL_LOCATION_TYPES)
  locationType?: ChannelLocationType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  locationId?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  includeArchived?: boolean;
}

export class ChannelMembersDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(MAX_CHANNEL_MEMBERS)
  @IsMongoId({ each: true })
  userIds: string[];
}

export class CreateDmDto {
  @ApiProperty({ description: 'Outro participante da conversa.' })
  @IsMongoId()
  userId: string;
}
