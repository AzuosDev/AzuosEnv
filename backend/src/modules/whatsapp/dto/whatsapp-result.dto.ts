import { ApiProperty } from '@nestjs/swagger';
import { WORKSPACE_ROLES, WorkspaceRole } from '../../workspaces/workspace-roles';
import { WaConnection } from '../schemas/wa-connection.schema';
import { WA_ACCESS_LEVELS, WaAccessLevel } from '../whatsapp-fields';

export class WaAccessEntryDto {
  @ApiProperty()
  userId: string;

  @ApiProperty({ enum: WORKSPACE_ROLES })
  role: WorkspaceRole;

  @ApiProperty({ enum: WA_ACCESS_LEVELS, nullable: true, description: 'null = sem acesso.' })
  level: WaAccessLevel | null;

  @ApiProperty({ description: 'Nível vem do papel: owner e admin são sempre gestor.' })
  fromRole: boolean;
}

export class WaAccessListDto {
  @ApiProperty({ type: [WaAccessEntryDto] })
  items: WaAccessEntryDto[];
}

export class WaMyAccessDto {
  @ApiProperty({ enum: WA_ACCESS_LEVELS, nullable: true })
  level: WaAccessLevel | null;
}

export class WaConnectionStatusDto {
  @ApiProperty({ type: WaConnection, nullable: true })
  connection: WaConnection | null;

  @ApiProperty({ description: 'URL que o app da Meta deve chamar.' })
  webhookUrl: string;
}

export class WaTemplateDto {
  @ApiProperty()
  name: string;

  @ApiProperty({ example: 'pt_BR' })
  language: string;

  @ApiProperty({ example: 'APPROVED' })
  status: string;

  @ApiProperty()
  category: string;

  @ApiProperty({ description: 'Quantas variáveis o corpo espera.' })
  variables: number;
}

export class WaTemplateListDto {
  @ApiProperty({ type: [WaTemplateDto] })
  items: WaTemplateDto[];
}

export class WaWebhookResultDto {
  @ApiProperty({ example: true })
  received: boolean;
}
