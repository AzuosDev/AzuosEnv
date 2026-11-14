import { ApiProperty } from '@nestjs/swagger';
import { WaBotRule } from '../schemas/wa-bot-rule.schema';

export class WaBotRuleListDto {
  @ApiProperty({ type: [WaBotRule] })
  items: WaBotRule[];
}

export class WaQuickReplyItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  shortcut: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ description: 'Texto cru, com as variáveis.' })
  text: string;

  @ApiProperty({ description: 'Texto com as variáveis resolvidas pela conversa.' })
  rendered: string;

  @ApiProperty()
  mediaUrl: string;

  @ApiProperty()
  mediaMime: string;

  @ApiProperty()
  filename: string;
}

export class WaQuickReplyPageDto {
  @ApiProperty({ type: [WaQuickReplyItemDto] })
  items: WaQuickReplyItemDto[];

  @ApiProperty({ nullable: true, description: 'Cursor da próxima página; null na última.' })
  nextCursor: string | null;
}

export class WaStatusCountsDto {
  @ApiProperty()
  open: number;

  @ApiProperty()
  waiting: number;

  @ApiProperty()
  closed: number;
}

export class WaDayCountDto {
  @ApiProperty({ example: '2026-11-13' })
  date: string;

  @ApiProperty()
  count: number;
}

export class WaAgentStatsDto {
  @ApiProperty()
  userId: string;

  @ApiProperty({ description: 'Conversas atribuídas a essa pessoa no período.' })
  conversations: number;

  @ApiProperty({ description: 'Conversas dela que foram finalizadas.' })
  resolved: number;

  @ApiProperty({ description: 'Mensagens que ela enviou no período.' })
  messages: number;

  @ApiProperty({ nullable: true, description: 'Média da primeira resposta, em segundos.' })
  firstResponseAvgSeconds: number | null;
}

export class WaOverviewDto {
  @ApiProperty({ description: 'Início do período, em UTC ISO 8601.' })
  from: string;

  @ApiProperty({ description: 'Fim do período, em UTC ISO 8601.' })
  to: string;

  @ApiProperty({ description: 'Fuso usado para agrupar os dias.' })
  timezone: string;

  @ApiProperty({ type: WaStatusCountsDto })
  byStatus: WaStatusCountsDto;

  @ApiProperty({ type: [WaDayCountDto], description: 'Conversas novas por dia.' })
  newPerDay: WaDayCountDto[];

  @ApiProperty()
  conversations: number;

  @ApiProperty({ description: 'Conversas finalizadas no período.' })
  resolved: number;

  @ApiProperty({ description: 'Finalizadas sem nenhuma mensagem de atendente.' })
  botResolved: number;

  @ApiProperty({ description: '% das finalizadas que o bot resolveu sozinho.' })
  botResolvedPercent: number;

  @ApiProperty({ nullable: true, description: 'Média da primeira resposta humana, em segundos.' })
  firstResponseAvgSeconds: number | null;

  @ApiProperty({ nullable: true, description: 'Média até finalizar, em segundos.' })
  resolutionAvgSeconds: number | null;

  @ApiProperty({ type: [WaAgentStatsDto] })
  byAgent: WaAgentStatsDto[];

  @ApiProperty({ description: 'true quando o período passou do teto de conversas lidas.' })
  truncated: boolean;
}
