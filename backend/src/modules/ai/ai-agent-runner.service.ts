import { Inject, Injectable, Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { MessagesService } from '../chat/messages.service';
import { PermissionContext } from '../hierarchy/permission.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TaskQueryDto } from '../tasks/dto/task-query.dto';
import { TaskDocument } from '../tasks/schemas/task.schema';
import { TaskQueryService } from '../tasks/task-query.service';
import { MembersService } from '../workspaces/members.service';
import { contextText } from './ai-context';
import { MAX_AGENT_TASKS, AiAgentType } from './ai-fields';
import { agentSystemPrompt } from './ai-prompts';
import { AI_PROVIDER, AiProvider } from './ai-provider';
import { AiUsageService } from './ai-usage.service';
import { AiAgentDocument } from './schemas/ai-agent.schema';

export interface AgentRunResult {
  text: string;
  delivered: 'channel' | 'inbox' | 'none';
}

const CLOSED_GROUPS = ['done', 'closed'];
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Runs one agent: reads the tasks with the permissions of whoever created it, asks
 * the model for the digest and delivers it to a channel or to the Inbox.
 */
@Injectable()
export class AiAgentRunnerService {
  private readonly logger = new Logger(AiAgentRunnerService.name);

  constructor(
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
    private readonly queries: TaskQueryService,
    private readonly messages: MessagesService,
    private readonly notifications: NotificationsService,
    private readonly members: MembersService,
    private readonly usage: AiUsageService,
  ) {}

  /** Public so the e2e suite runs an agent without waiting for the cron. */
  async run(agent: AiAgentDocument, now = new Date()): Promise<AgentRunResult> {
    await this.usage.assertBudget(agent.workspaceId);

    const ctx: PermissionContext = {
      workspaceId: agent.workspaceId,
      userId: agent.createdBy,
      role: 'owner',
    };
    const content = await this.context(ctx, agent.type, now);
    const completion = await this.provider.complete({
      messages: [
        { role: 'system', content: agentSystemPrompt() },
        { role: 'user', content },
      ],
      temperature: 0.2,
    });

    await this.usage.record({
      workspaceId: agent.workspaceId,
      userId: null,
      feature: 'agent',
      usage: completion.usage,
      model: completion.model,
    });

    const text = completion.content.trim();

    agent.lastRunAt = now;
    await agent.save();

    return { text, delivered: await this.deliver(ctx, agent, text) };
  }

  /** The digest lands in a channel when the config names one, else in the Inbox. */
  private async deliver(
    ctx: PermissionContext,
    agent: AiAgentDocument,
    text: string,
  ): Promise<'channel' | 'inbox' | 'none'> {
    const channelId = this.objectId(agent.config.channelId);

    if (channelId) {
      await this.messages.create(ctx, channelId, {
        bodyText: `${agent.name}\n\n${text}`,
      });

      return 'channel';
    }

    const recipients = await this.recipients(agent);

    if (recipients.length === 0) {
      return 'none';
    }

    await this.notifications.deliver({
      workspaceId: agent.workspaceId,
      type: 'aiSummary',
      entityType: 'workspace',
      entityId: agent.workspaceId,
      actorId: null,
      recipients: recipients.map((userId) => ({ userId, bucket: 'primary' as const })),
      data: { agentId: String(agent._id), agentType: agent.type, name: agent.name, text },
    });

    return 'inbox';
  }

  private async recipients(agent: AiAgentDocument): Promise<Types.ObjectId[]> {
    const configured = Array.isArray(agent.config.userIds)
      ? agent.config.userIds
          .map((value) => this.objectId(value))
          .filter((value): value is Types.ObjectId => value !== null)
      : [];
    const wanted = configured.length > 0 ? configured : [agent.createdBy];

    return this.members.activeUserIds(agent.workspaceId, wanted);
  }

  private async context(ctx: PermissionContext, type: AiAgentType, now: Date): Promise<string> {
    if (type === 'overdueDigest') {
      return contextText(
        ['Monte o resumo das tarefas atrasadas:', ...this.lines(await this.overdue(ctx, now))].join(
          '\n',
        ),
        12_000,
      );
    }

    if (type === 'bugTriage') {
      const open = await this.open(ctx);
      const bugs = open.filter((task) => task.type === 'bug' && task.priority === null);

      return contextText(
        [
          'Para cada bug abaixo, sugira uma prioridade (urgent, high, normal ou low) e justifique em uma linha:',
          ...this.lines(bugs),
        ].join('\n'),
        12_000,
      );
    }

    const open = await this.open(ctx);
    const overdue = open.filter((task) => this.isOverdue(task, now));
    const today = open.filter(
      (task) =>
        task.dueAt !== null &&
        task.dueAt.getTime() >= now.getTime() &&
        task.dueAt.getTime() < now.getTime() + DAY_MS,
    );
    const closed = (
      await this.queries.queryAll(ctx, {
        location: 'everything',
        includeSubtasks: true,
        includeClosed: true,
      } as TaskQueryDto)
    ).filter((task) => task.closedAt !== null && task.closedAt.getTime() >= now.getTime() - DAY_MS);

    return contextText(
      [
        'Monte o resumo diário do workspace com as seções abaixo.',
        'Atrasadas:',
        ...this.lines(overdue),
        'Vencem nas próximas 24 h:',
        ...this.lines(today),
        'Concluídas nas últimas 24 h:',
        ...this.lines(closed),
      ].join('\n'),
      12_000,
    );
  }

  private async open(ctx: PermissionContext): Promise<TaskDocument[]> {
    const tasks = await this.queries.queryAll(ctx, {
      location: 'everything',
      includeSubtasks: true,
      sortBy: 'dueAt',
    } as TaskQueryDto);

    return tasks.filter((task) => !CLOSED_GROUPS.includes(task.statusGroup));
  }

  private async overdue(ctx: PermissionContext, now: Date): Promise<TaskDocument[]> {
    return (await this.open(ctx)).filter((task) => this.isOverdue(task, now));
  }

  private isOverdue(task: TaskDocument, now: Date): boolean {
    return task.dueAt !== null && task.dueAt.getTime() < now.getTime();
  }

  private lines(tasks: TaskDocument[]): string[] {
    if (tasks.length === 0) {
      return ['- (nenhuma)'];
    }

    return tasks
      .slice(0, MAX_AGENT_TASKS)
      .map(
        (task) =>
          `- ${task.customId} ${task.name} · status ${task.statusGroup} · prazo ${
            task.dueAt?.toISOString() ?? 'sem prazo'
          } · prioridade ${task.priority ?? 'sem prioridade'}`,
      );
  }

  private objectId(value: unknown): Types.ObjectId | null {
    if (value instanceof Types.ObjectId) {
      return value;
    }

    if (typeof value === 'string' && Types.ObjectId.isValid(value)) {
      return new Types.ObjectId(value);
    }

    if (value !== undefined && value !== null) {
      this.logger.warn('Config de agente com id inválido.');
    }

    return null;
  }
}
