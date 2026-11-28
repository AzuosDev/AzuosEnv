import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto';
import {
  DEFAULT_WA_PROVIDER,
  EVOLUTION_INSTANCE,
  WA_ACCESS_LEVELS,
  WA_CONVERSATION_FILTERS,
  WA_CONVERSATION_MODES,
  WA_PRIORITIES,
  WA_PROVIDERS,
  WaAccessLevel,
  WaConversationFilter,
  WaConversationMode,
  WaPriority,
  WaProvider,
} from '../whatsapp-fields';

/** Digits only, with the country code, as Meta formats a wa_id. */
const WA_ID = /^[0-9]{8,20}$/;

export class GrantWaAccessDto {
  @ApiProperty({ enum: WA_ACCESS_LEVELS })
  @IsEnum(WA_ACCESS_LEVELS)
  level: WaAccessLevel;
}

/** Qual metade do formulário é obrigatória depende do provedor escolhido. */
function providerOf(dto: SaveWaConnectionDto): WaProvider {
  return dto.provider ?? DEFAULT_WA_PROVIDER;
}

const isEvolution = (dto: SaveWaConnectionDto): boolean => providerOf(dto) === 'evolution';
const isCloud = (dto: SaveWaConnectionDto): boolean => providerOf(dto) === 'cloud';

export class SaveWaConnectionDto {
  @ApiPropertyOptional({
    enum: WA_PROVIDERS,
    default: DEFAULT_WA_PROVIDER,
    description: 'evolution conecta por QR Code; cloud é a Cloud API oficial.',
  })
  @IsOptional()
  @IsEnum(WA_PROVIDERS)
  provider?: WaProvider;

  @ApiPropertyOptional({ description: 'Evolution: origem do servidor.' })
  @ValidateIf(isEvolution)
  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  @Length(1, 300)
  baseUrl?: string;

  @ApiPropertyOptional({ description: 'Evolution: API key; guardada criptografada.' })
  @ValidateIf(isEvolution)
  @IsString()
  @Length(1, 300)
  apiKey?: string;

  @ApiPropertyOptional({ description: 'Evolution: nome da instância.' })
  @ValidateIf(isEvolution)
  @Matches(EVOLUTION_INSTANCE, {
    message: 'instanceName aceita letras, números, ponto, hífen e sublinhado.',
  })
  instanceName?: string;

  @ApiPropertyOptional({
    description:
      'Evolution: aceita salvar um nome de instância que já existe no servidor. ' +
      'Sem isto, nome em uso é recusado; a posse só vem depois, pelo /connection/adopt.',
  })
  @IsOptional()
  @IsBoolean()
  adoptExisting?: boolean;

  @ApiPropertyOptional({ description: 'Cloud API: id do número dentro da WABA.' })
  @ValidateIf(isCloud)
  @IsString()
  @Length(1, 60)
  phoneNumberId?: string;

  @ApiPropertyOptional({ description: 'Cloud API: id da conta do WhatsApp Business.' })
  @ValidateIf(isCloud)
  @IsString()
  @Length(1, 60)
  wabaId?: string;

  @ApiPropertyOptional({ description: 'Cloud API: token permanente; criptografado.' })
  @ValidateIf(isCloud)
  @IsString()
  @Length(1, 500)
  accessToken?: string;

  @ApiPropertyOptional({ description: 'Cloud API: App Secret que assina o webhook.' })
  @ValidateIf(isCloud)
  @IsString()
  @Length(1, 200)
  appSecret?: string;

  @ApiPropertyOptional({ description: 'Cloud API: token da verificação do webhook.' })
  @ValidateIf(isCloud)
  @IsString()
  @Length(8, 200)
  verifyToken?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 40)
  displayPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 200)
  verifiedName?: string;
}

export class WaConversationQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: WA_CONVERSATION_FILTERS, default: 'open' })
  @IsOptional()
  @IsEnum(WA_CONVERSATION_FILTERS)
  filter?: WaConversationFilter;

  @ApiPropertyOptional({ description: 'Busca por nome, número ou texto da mensagem.' })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  q?: string;
}

export class WaContactQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Busca por nome ou número.' })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  q?: string;
}

export class AssignWaConversationDto {
  @ApiPropertyOptional({ nullable: true, description: 'null devolve a conversa para a fila.' })
  @IsOptional()
  @IsMongoId()
  assigneeId?: string | null;
}

export class WaPriorityDto {
  @ApiProperty({ enum: WA_PRIORITIES })
  @IsEnum(WA_PRIORITIES)
  priority: WaPriority;
}

export class WaModeDto {
  @ApiProperty({ enum: WA_CONVERSATION_MODES })
  @IsEnum(WA_CONVERSATION_MODES)
  mode: WaConversationMode;

  @ApiPropertyOptional({ nullable: true, description: 'UTC ISO 8601; pausa o bot até a data.' })
  @IsOptional()
  @IsDateString()
  botPausedUntil?: string | null;
}

export class SendWaTextDto {
  @ApiProperty()
  @IsString()
  @Length(1, 4096)
  text: string;

  @ApiPropertyOptional({ description: 'waMessageId da mensagem citada.' })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  replyTo?: string;
}

export class SendWaMediaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 1024)
  caption?: string;

  @ApiPropertyOptional({ description: 'waMessageId da mensagem citada.' })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  replyTo?: string;
}

export class SendWaTemplateDto {
  @ApiProperty({ description: 'Nome do template aprovado no WABA.' })
  @IsString()
  @Length(1, 200)
  name: string;

  @ApiProperty({ example: 'pt_BR' })
  @IsString()
  @Length(2, 20)
  language: string;

  @ApiPropertyOptional({ type: [String], description: 'Variáveis do corpo, na ordem.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  variables?: string[];
}

export class CreateWaContactDto {
  @ApiProperty({ description: 'Número só com dígitos, com o código do país.' })
  @Matches(WA_ID, { message: 'waId deve ter só dígitos, com o código do país.' })
  waId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 200)
  name?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 4000)
  notes?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsMongoId()
  spaceId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsMongoId()
  folderId?: string | null;
}

export class UpdateWaContactDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 200)
  name?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 4000)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  optOut?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsMongoId()
  spaceId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsMongoId()
  folderId?: string | null;
}

export class WaConversationTaskDto {
  @ApiProperty({ description: 'List onde a tarefa é criada.' })
  @IsMongoId()
  listId: string;

  @ApiPropertyOptional({ description: 'Ausente usa o nome do contato.' })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  name?: string;
}

export class WaConversationLeadDto {
  @ApiPropertyOptional({ description: 'Ausente usa a List Leads do Space Comercial.' })
  @IsOptional()
  @IsMongoId()
  listId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 500)
  name?: string;
}
