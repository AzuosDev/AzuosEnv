import { ApiProperty, IntersectionType } from '@nestjs/swagger';
import { WORKSPACE_ROLES, WorkspaceRole } from '../../workspaces/workspace-roles';
import { WaConnection } from '../schemas/wa-connection.schema';
import { WaContact } from '../schemas/wa-contact.schema';
import { WaConversation } from '../schemas/wa-conversation.schema';
import { WaMessage } from '../schemas/wa-message.schema';
import {
  WA_ACCESS_LEVELS,
  WA_CONNECTION_STATUSES,
  WaAccessLevel,
  WaConnectionStatus,
} from '../whatsapp-fields';

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

/** O que o provedor da conexão sabe fazer; a tela se molda por isso. */
export class WaCapabilitiesDto {
  @ApiProperty({ description: 'Templates aprovados existem (só na Cloud API).' })
  templates: boolean;

  @ApiProperty({ description: 'Texto livre só dentro da janela de 24 h.' })
  window: boolean;

  @ApiProperty({ description: 'O número é pareado lendo um QR Code.' })
  qrCode: boolean;
}

export class WaConnectionStatusDto {
  @ApiProperty({ type: WaConnection, nullable: true })
  connection: WaConnection | null;

  @ApiProperty({ description: 'URL que o app da Meta deve chamar; vazia na Evolution.' })
  webhookUrl: string;

  @ApiProperty({ type: WaCapabilitiesDto })
  capabilities: WaCapabilitiesDto;
}

/** QR Code do pareamento, como a aba Conexão mostra. */
export class WaQrCodeDto {
  @ApiProperty({ nullable: true, description: 'Imagem em base64 (data URI).' })
  qrCode: string | null;

  @ApiProperty({ nullable: true, description: 'UTC ISO 8601 da última leitura.' })
  qrCodeAt: Date | null;

  @ApiProperty({ enum: WA_CONNECTION_STATUSES })
  status: WaConnectionStatus;

  @ApiProperty()
  displayPhone: string;

  @ApiProperty()
  verifiedName: string;

  @ApiProperty({ description: 'URL que a instância chama; o segredo vai nela.' })
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

/** What a row of the inbox needs beyond the conversation itself. */
export class WaConversationExtrasDto {
  @ApiProperty({ type: WaContact, nullable: true })
  contact: WaContact | null;

  @ApiProperty({
    type: WaMessage,
    nullable: true,
    description: 'Última mensagem da conversa, para a prévia da lista.',
  })
  lastMessage: WaMessage | null;
}

/** Conversation of the list: the document plus the contact and the preview. */
export class WaConversationItemDto extends IntersectionType(
  WaConversation,
  WaConversationExtrasDto,
) {}
