import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto';
import {
  MAX_WA_AI_ANSWER_CHARS,
  MAX_WA_BOT_PAUSE_MINUTES,
  MAX_WA_KNOWLEDGE_CHARS,
  MAX_WA_LIST_ROWS,
  MAX_WA_QUICK_REPLY_CHARS,
  WA_BOT_ACTION_KINDS,
  WA_BOT_REPLY_KINDS,
  WA_BOT_TRIGGERS,
  WA_DATE_KEY,
  WA_MENU_KINDS,
  WA_PRIORITIES,
  WA_SHORTCUT,
  WA_TIME_OF_DAY,
  WaBotActionKind,
  WaBotReplyKind,
  WaBotTrigger,
  WaMenuKind,
  WaPriority,
} from '../whatsapp-fields';

export class WaMenuOptionDto {
  @ApiProperty({ description: 'Id devolvido quando o contato escolhe a opção.' })
  @IsString()
  @Length(1, 60)
  id: string;

  @ApiProperty({ description: 'Até 24 caracteres, limite do WhatsApp.' })
  @IsString()
  @Length(1, 24)
  title: string;

  @ApiPropertyOptional({ description: 'Só aparece na lista interativa.' })
  @IsOptional()
  @IsString()
  @Length(0, 72)
  description?: string;
}

export class WaBotMenuDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ enum: WA_MENU_KINDS })
  @IsOptional()
  @IsEnum(WA_MENU_KINDS)
  kind?: WaMenuKind;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 60)
  header?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 1024)
  body?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 60)
  footer?: string;

  @ApiPropertyOptional({ description: 'Rótulo que abre a lista interativa.' })
  @IsOptional()
  @IsString()
  @Length(0, 20)
  buttonLabel?: string;

  @ApiPropertyOptional({ type: [WaMenuOptionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_WA_LIST_ROWS)
  @ValidateNested({ each: true })
  @Type(() => WaMenuOptionDto)
  options?: WaMenuOptionDto[];
}

export class WaBotAiDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Base de conhecimento que a IA pode afirmar.' })
  @IsOptional()
  @IsString()
  @Length(0, MAX_WA_KNOWLEDGE_CHARS)
  knowledgeBase?: string;

  @ApiPropertyOptional({ maximum: MAX_WA_AI_ANSWER_CHARS })
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(MAX_WA_AI_ANSWER_CHARS)
  maxAnswerChars?: number;
}

export class WaHoursRangeDto {
  @ApiProperty({ example: '09:00' })
  @Matches(WA_TIME_OF_DAY, { message: 'start deve estar no formato HH:mm.' })
  start: string;

  @ApiProperty({ example: '18:00' })
  @Matches(WA_TIME_OF_DAY, { message: 'end deve estar no formato HH:mm.' })
  end: string;
}

export class WaHoursDayDto {
  @ApiProperty({ description: '0 = domingo.', minimum: 0, maximum: 6 })
  @IsInt()
  @Min(0)
  @Max(6)
  weekday: number;

  @ApiProperty({ type: [WaHoursRangeDto] })
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => WaHoursRangeDto)
  ranges: WaHoursRangeDto[];
}

export class WaHolidayDto {
  @ApiProperty({ example: '2026-12-25' })
  @Matches(WA_DATE_KEY, { message: 'date deve estar no formato YYYY-MM-DD.' })
  date: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  name?: string;
}

export class WaBotHoursDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Vazio usa o fuso do workspace.' })
  @IsOptional()
  @IsString()
  @Length(0, 60)
  timezone?: string;

  @ApiPropertyOptional({ type: [WaHoursDayDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => WaHoursDayDto)
  days?: WaHoursDayDto[];

  @ApiPropertyOptional({ type: [WaHolidayDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => WaHolidayDto)
  holidays?: WaHolidayDto[];

  @ApiPropertyOptional({ description: 'Enviada fora do horário de atendimento.' })
  @IsOptional()
  @IsString()
  @Length(0, 1024)
  awayMessage?: string;
}

export class SaveWaBotSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Primeira resposta da conversa.' })
  @IsOptional()
  @IsString()
  @Length(0, 1024)
  welcomeMessage?: string;

  @ApiPropertyOptional({ type: WaBotMenuDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => WaBotMenuDto)
  menu?: WaBotMenuDto;

  @ApiPropertyOptional({ description: 'Enviada ao transferir para um humano.' })
  @IsOptional()
  @IsString()
  @Length(0, 1024)
  handoffMessage?: string;

  @ApiPropertyOptional({ default: 30, maximum: MAX_WA_BOT_PAUSE_MINUTES })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_WA_BOT_PAUSE_MINUTES)
  pauseMinutes?: number;

  @ApiPropertyOptional({ description: 'Enviada quando o atendente finaliza a conversa.' })
  @IsOptional()
  @IsString()
  @Length(0, 1024)
  closingMessage?: string;

  @ApiPropertyOptional({ type: WaBotAiDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => WaBotAiDto)
  ai?: WaBotAiDto;

  @ApiPropertyOptional({ type: WaBotHoursDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => WaBotHoursDto)
  hours?: WaBotHoursDto;
}

export class WaBotRuleTriggerDto {
  @ApiProperty({ enum: WA_BOT_TRIGGERS })
  @IsEnum(WA_BOT_TRIGGERS)
  kind: WaBotTrigger;

  @ApiPropertyOptional({ description: 'Palavra, trecho, regex ou id da opção do menu.' })
  @IsOptional()
  @IsString()
  @Length(0, 400)
  value?: string;
}

export class WaBotRuleReplyDto {
  @ApiPropertyOptional({ enum: WA_BOT_REPLY_KINDS })
  @IsOptional()
  @IsEnum(WA_BOT_REPLY_KINDS)
  kind?: WaBotReplyKind;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 4096)
  text?: string;

  @ApiPropertyOptional({ description: 'Link público do arquivo; a Meta busca por ele.' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  mediaUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  mediaMime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 200)
  filename?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 60)
  header?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 60)
  footer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 20)
  buttonLabel?: string;

  @ApiPropertyOptional({ type: [WaMenuOptionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_WA_LIST_ROWS)
  @ValidateNested({ each: true })
  @Type(() => WaMenuOptionDto)
  options?: WaMenuOptionDto[];
}

export class WaBotRuleActionDto {
  @ApiProperty({ enum: WA_BOT_ACTION_KINDS })
  @IsEnum(WA_BOT_ACTION_KINDS)
  kind: WaBotActionKind;

  @ApiPropertyOptional({ description: 'Responsável do assign.' })
  @IsOptional()
  @IsMongoId()
  userId?: string;

  @ApiPropertyOptional({ description: 'Etiqueta aplicada ao contato.' })
  @IsOptional()
  @IsString()
  @Length(1, 60)
  tag?: string;

  @ApiPropertyOptional({ enum: WA_PRIORITIES })
  @IsOptional()
  @IsEnum(WA_PRIORITIES)
  priority?: WaPriority;

  @ApiPropertyOptional({ description: 'List do lead; ausente usa Comercial › Leads.' })
  @IsOptional()
  @IsMongoId()
  listId?: string;
}

export class CreateWaBotRuleDto {
  @ApiProperty()
  @IsString()
  @Length(1, 200)
  name: string;

  @ApiProperty({ type: WaBotRuleTriggerDto })
  @ValidateNested()
  @Type(() => WaBotRuleTriggerDto)
  trigger: WaBotRuleTriggerDto;

  @ApiPropertyOptional({ type: WaBotRuleReplyDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => WaBotRuleReplyDto)
  reply?: WaBotRuleReplyDto;

  @ApiPropertyOptional({ type: [WaBotRuleActionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => WaBotRuleActionDto)
  actions?: WaBotRuleActionDto[];

  @ApiPropertyOptional({ description: 'Maior vence; empate vai para a regra mais antiga.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  priority?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateWaBotRuleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

  @ApiPropertyOptional({ type: WaBotRuleTriggerDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => WaBotRuleTriggerDto)
  trigger?: WaBotRuleTriggerDto;

  @ApiPropertyOptional({ type: WaBotRuleReplyDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => WaBotRuleReplyDto)
  reply?: WaBotRuleReplyDto;

  @ApiPropertyOptional({ type: [WaBotRuleActionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => WaBotRuleActionDto)
  actions?: WaBotRuleActionDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  priority?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateWaQuickReplyDto {
  @ApiProperty({ description: 'Atalho digitado depois da "/"; minúsculas.' })
  @Matches(WA_SHORTCUT, { message: 'shortcut aceita letras minúsculas, números, ponto, _ e -.' })
  shortcut: string;

  @ApiProperty()
  @IsString()
  @Length(1, 200)
  title: string;

  @ApiPropertyOptional({ description: 'Aceita variáveis como {nome}.' })
  @IsOptional()
  @IsString()
  @Length(0, MAX_WA_QUICK_REPLY_CHARS)
  text?: string;

  @ApiPropertyOptional({ description: 'Link público do arquivo enviado junto.' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  mediaUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  mediaMime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 200)
  filename?: string;
}

export class UpdateWaQuickReplyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(WA_SHORTCUT, { message: 'shortcut aceita letras minúsculas, números, ponto, _ e -.' })
  shortcut?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, MAX_WA_QUICK_REPLY_CHARS)
  text?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  mediaUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 120)
  mediaMime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 200)
  filename?: string;
}

export class WaQuickReplyQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Busca por atalho, título ou texto.' })
  @IsOptional()
  @IsString()
  @Length(1, 60)
  q?: string;

  @ApiPropertyOptional({ description: 'Resolve as variáveis com os dados da conversa.' })
  @IsOptional()
  @IsMongoId()
  conversationId?: string;
}

export class WaOverviewQueryDto {
  @ApiPropertyOptional({ description: 'UTC ISO 8601; ausente usa os últimos 30 dias.' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'UTC ISO 8601; ausente usa agora.' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
