import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsMongoId } from 'class-validator';
import {
  PERMISSION_LEVELS,
  PRINCIPAL_TYPES,
  PermissionLevel,
  PrincipalType,
  SHAREABLE_RESOURCE_TYPES,
  ShareableResourceType,
} from '../permission-levels';

export class ShareDto {
  @ApiProperty({ enum: SHAREABLE_RESOURCE_TYPES })
  @IsEnum(SHAREABLE_RESOURCE_TYPES)
  resourceType: ShareableResourceType;

  @ApiProperty()
  @IsMongoId()
  resourceId: string;

  @ApiProperty({ enum: PRINCIPAL_TYPES })
  @IsEnum(PRINCIPAL_TYPES)
  principalType: PrincipalType;

  @ApiProperty({ description: 'Id do usuário ou da equipe.' })
  @IsMongoId()
  principalId: string;

  @ApiProperty({ enum: PERMISSION_LEVELS })
  @IsEnum(PERMISSION_LEVELS)
  level: PermissionLevel;
}

export class ResourceQueryDto {
  @ApiProperty({ enum: SHAREABLE_RESOURCE_TYPES })
  @IsEnum(SHAREABLE_RESOURCE_TYPES)
  resourceType: ShareableResourceType;

  @ApiProperty()
  @IsMongoId()
  resourceId: string;
}
