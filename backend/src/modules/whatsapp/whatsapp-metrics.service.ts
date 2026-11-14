import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { safeTimeZone, zonedDateKey } from '../../common/utils/timezone';
import { PermissionContext } from '../hierarchy/permission.service';
import { Workspace } from '../workspaces/schemas/workspace.schema';
import { WaAgentStatsDto, WaOverviewDto } from './dto/whatsapp-bot-result.dto';
import { WaOverviewQueryDto } from './dto/whatsapp-bot.dto';
import { WaConversation } from './schemas/wa-conversation.schema';
import { WaMessage } from './schemas/wa-message.schema';
import {
  DEFAULT_WA_OVERVIEW_DAYS,
  MAX_WA_OVERVIEW_CONVERSATIONS,
  MAX_WA_OVERVIEW_DAYS,
} from './whatsapp-fields';

const DAY_MS = 24 * 60 * 60 * 1000;

/** One conversation of the period with the timings read from its messages. */
interface ConversationTiming {
  firstInbound: Date | null;
  firstHuman: Date | null;
  humanMessages: number;
}

interface TimingRow {
  _id: Types.ObjectId;
  firstInbound: Date | null;
  firstHuman: Date | null;
  humanMessages: number;
}

/**
 * Overview of the attendance in a period: conversations by status, new ones per
 * day, the average first response and resolution, the numbers of each attendant
 * and how much the bot resolved on its own.
 */
@Injectable()
export class WhatsappMetricsService {
  constructor(
    @InjectModel(WaConversation.name) private readonly conversations: Model<WaConversation>,
    @InjectModel(WaMessage.name) private readonly messages: Model<WaMessage>,
    @InjectModel(Workspace.name) private readonly workspaces: Model<Workspace>,
  ) {}

  async overview(ctx: PermissionContext, query: WaOverviewQueryDto): Promise<WaOverviewDto> {
    const { from, to } = this.periodOf(query);
    const workspace = await this.workspaces.findOne({ _id: ctx.workspaceId }).exec();
    const timezone = safeTimeZone(workspace?.timezone);
    const docs = await this.conversations
      .find({ workspaceId: ctx.workspaceId, createdAt: { $gte: from, $lt: to } })
      .sort({ _id: 1 })
      .limit(MAX_WA_OVERVIEW_CONVERSATIONS + 1)
      .exec();
    const truncated = docs.length > MAX_WA_OVERVIEW_CONVERSATIONS;
    const items = truncated ? docs.slice(0, MAX_WA_OVERVIEW_CONVERSATIONS) : docs;
    const ids = items.map((item) => item._id);
    const timings = await this.timingsOf(ctx.workspaceId, ids);
    const messagesByAuthor = await this.messagesByAuthor(ctx.workspaceId, ids);

    const byStatus = { open: 0, waiting: 0, closed: 0 };
    const perDay = new Map<string, number>();
    const firstResponses: number[] = [];
    const resolutions: number[] = [];
    const agents = new Map<string, { conversations: number; resolved: number; waits: number[] }>();
    let resolved = 0;
    let botResolved = 0;

    for (const conversation of items) {
      byStatus[conversation.status] += 1;

      const createdAt = this.createdAtOf(conversation);
      const dateKey = zonedDateKey(createdAt, timezone);

      perDay.set(dateKey, (perDay.get(dateKey) ?? 0) + 1);

      const timing = timings.get(String(conversation._id)) ?? {
        firstInbound: null,
        firstHuman: null,
        humanMessages: 0,
      };
      const wait = this.secondsBetween(timing.firstInbound, timing.firstHuman);

      if (wait !== null) {
        firstResponses.push(wait);
      }

      if (conversation.status === 'closed') {
        resolved += 1;

        const total = this.secondsBetween(createdAt, conversation.closedAt);

        if (total !== null) {
          resolutions.push(total);
        }

        if (timing.humanMessages === 0) {
          botResolved += 1;
        }
      }

      if (conversation.assigneeId) {
        const key = String(conversation.assigneeId);
        const agent = agents.get(key) ?? { conversations: 0, resolved: 0, waits: [] };

        agent.conversations += 1;

        if (conversation.status === 'closed') {
          agent.resolved += 1;
        }

        if (wait !== null) {
          agent.waits.push(wait);
        }

        agents.set(key, agent);
      }
    }

    for (const userId of messagesByAuthor.keys()) {
      if (!agents.has(userId)) {
        agents.set(userId, { conversations: 0, resolved: 0, waits: [] });
      }
    }

    const byAgent: WaAgentStatsDto[] = [...agents.entries()]
      .map(([userId, agent]) => ({
        userId,
        conversations: agent.conversations,
        resolved: agent.resolved,
        messages: messagesByAuthor.get(userId) ?? 0,
        firstResponseAvgSeconds: this.averageOf(agent.waits),
      }))
      .sort((left, right) => right.conversations - left.conversations);

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      timezone,
      byStatus,
      newPerDay: this.daysOf(from, to, timezone, perDay),
      conversations: items.length,
      resolved,
      botResolved,
      botResolvedPercent: resolved === 0 ? 0 : Math.round((botResolved / resolved) * 1000) / 10,
      firstResponseAvgSeconds: this.averageOf(firstResponses),
      resolutionAvgSeconds: this.averageOf(resolutions),
      byAgent,
      truncated,
    };
  }

  /** First inbound, first human answer and how many an attendant wrote. */
  private async timingsOf(
    workspaceId: Types.ObjectId,
    ids: Types.ObjectId[],
  ): Promise<Map<string, ConversationTiming>> {
    if (ids.length === 0) {
      return new Map();
    }

    const rows = await this.messages
      .aggregate<TimingRow>([
        { $match: { workspaceId, conversationId: { $in: ids } } },
        {
          $group: {
            _id: '$conversationId',
            firstInbound: {
              $min: { $cond: [{ $eq: ['$direction', 'inbound'] }, '$sentAt', null] },
            },
            firstHuman: {
              $min: {
                $cond: [
                  { $and: [{ $eq: ['$direction', 'outbound'] }, { $ne: ['$authorId', null] }] },
                  '$sentAt',
                  null,
                ],
              },
            },
            humanMessages: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$direction', 'outbound'] }, { $ne: ['$authorId', null] }] },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ])
      .exec();

    return new Map(
      rows.map((row) => [
        String(row._id),
        {
          firstInbound: row.firstInbound ? new Date(row.firstInbound) : null,
          firstHuman: row.firstHuman ? new Date(row.firstHuman) : null,
          humanMessages: row.humanMessages,
        },
      ]),
    );
  }

  /** Messages each attendant sent on the conversations of the period. */
  private async messagesByAuthor(
    workspaceId: Types.ObjectId,
    ids: Types.ObjectId[],
  ): Promise<Map<string, number>> {
    if (ids.length === 0) {
      return new Map();
    }

    const rows = await this.messages
      .aggregate<{ _id: Types.ObjectId; total: number }>([
        {
          $match: {
            workspaceId,
            conversationId: { $in: ids },
            direction: 'outbound',
            authorId: { $ne: null },
          },
        },
        { $group: { _id: '$authorId', total: { $sum: 1 } } },
      ])
      .exec();

    return new Map(rows.map((row) => [String(row._id), row.total]));
  }

  /** Every day of the period, so a day with no conversation still shows up. */
  private daysOf(
    from: Date,
    to: Date,
    timezone: string,
    counts: Map<string, number>,
  ): { date: string; count: number }[] {
    const days: { date: string; count: number }[] = [];
    const seen = new Set<string>();

    for (let at = from.getTime(); at < to.getTime(); at += DAY_MS) {
      const key = zonedDateKey(new Date(at), timezone);

      if (!seen.has(key)) {
        seen.add(key);
        days.push({ date: key, count: counts.get(key) ?? 0 });
      }
    }

    for (const [key, count] of counts.entries()) {
      if (!seen.has(key)) {
        seen.add(key);
        days.push({ date: key, count });
      }
    }

    return days.sort((left, right) => left.date.localeCompare(right.date));
  }

  private periodOf(query: WaOverviewQueryDto): { from: Date; to: Date } {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - DEFAULT_WA_OVERVIEW_DAYS * DAY_MS);

    if (from.getTime() >= to.getTime()) {
      throw new BadRequestException({
        code: 'INVALID_PERIOD',
        message: 'O início do período deve vir antes do fim.',
      });
    }

    if (to.getTime() - from.getTime() > MAX_WA_OVERVIEW_DAYS * DAY_MS) {
      throw new BadRequestException({
        code: 'PERIOD_TOO_LONG',
        message: `O período não pode passar de ${MAX_WA_OVERVIEW_DAYS} dias.`,
      });
    }

    return { from, to };
  }

  private createdAtOf(conversation: { _id: Types.ObjectId; createdAt?: Date }): Date {
    return conversation.createdAt ?? conversation._id.getTimestamp();
  }

  private secondsBetween(start: Date | null, end: Date | null): number | null {
    if (!start || !end) {
      return null;
    }

    const seconds = Math.round((end.getTime() - start.getTime()) / 1000);

    return seconds < 0 ? null : seconds;
  }

  private averageOf(values: number[]): number | null {
    if (values.length === 0) {
      return null;
    }

    return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
  }
}
