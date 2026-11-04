import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChatAccessService } from '../chat/chat-access.service';
import { Message, MessageDocument } from '../chat/schemas/message.schema';
import { CommentsService } from '../collaboration/comments.service';
import { DocsAccessService } from '../docs/docs-access.service';
import { DocPage } from '../docs/schemas/doc-page.schema';
import { HierarchyAccessService } from '../hierarchy/hierarchy-access.service';
import { PermissionContext } from '../hierarchy/permission.service';
import { TaskDocument } from '../tasks/schemas/task.schema';
import { TasksService } from '../tasks/tasks.service';
import { Workspace } from '../workspaces/schemas/workspace.schema';
import { contextText, truncate } from './ai-context';
import {
  MAX_AI_TEXT_LENGTH,
  MAX_CONTEXT_MESSAGE_CHARS,
  MAX_SUMMARY_ITEMS,
  AiSummarizeEntityType,
  AiWriteAction,
} from './ai-fields';
import { summarizeSystemPrompt, tasksFromTextSystemPrompt, writeSystemPrompt } from './ai-prompts';
import { AI_PROVIDER, AiProvider } from './ai-provider';
import { ProposedTask, validateTaskProposal } from './ai-task-proposal';
import { AiUsageService } from './ai-usage.service';
import {
  AiSummarizeDto,
  AiTasksFromTextDto,
  AiWriteDto,
  ConfirmTasksFromTextDto,
} from './dto/ai.dto';

export interface AiSummaryResult {
  entityType: AiSummarizeEntityType;
  id: string;
  summary: string;
}

export interface AiTaskProposalResult {
  listId: string;
  tasks: ProposedTask[];
  warnings: string[];
}

export interface AiConfirmResult {
  listId: string;
  created: TaskDocument[];
}

export interface AiWriteResult {
  action: AiWriteAction;
  text: string;
}

/** Context of the whole summarize window. */
const MAX_SUMMARY_CHARS = 12_000;

/**
 * One-shot features of the AI: summaries of an entity, tasks out of a free text and
 * rewrites of a text. Nothing is created without the confirm endpoint.
 */
@Injectable()
export class AiAssistService {
  constructor(
    @InjectModel(Message.name) private readonly messages: Model<Message>,
    @InjectModel(DocPage.name) private readonly pages: Model<DocPage>,
    @InjectModel(Workspace.name) private readonly workspaces: Model<Workspace>,
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
    private readonly tasks: TasksService,
    private readonly comments: CommentsService,
    private readonly chat: ChatAccessService,
    private readonly docs: DocsAccessService,
    private readonly hierarchy: HierarchyAccessService,
    private readonly usage: AiUsageService,
  ) {}

  async summarize(ctx: PermissionContext, dto: AiSummarizeDto): Promise<AiSummaryResult> {
    await this.usage.assertAllowed(ctx.workspaceId, ctx.userId);

    const content = await this.summaryContext(ctx, dto);
    const completion = await this.provider.complete({
      messages: [
        { role: 'system', content: summarizeSystemPrompt(dto.entityType) },
        {
          role: 'user',
          content: [
            dto.instruction ? contextText(dto.instruction, 1000) : 'Resuma o conteúdo abaixo.',
            '',
            truncate(content, MAX_SUMMARY_CHARS),
          ].join('\n'),
        },
      ],
      temperature: 0.2,
    });

    await this.usage.record({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      feature: 'summarize',
      usage: completion.usage,
      model: completion.model,
    });

    return { entityType: dto.entityType, id: dto.id, summary: completion.content.trim() };
  }

  /** Only proposes: nothing is written until the confirm endpoint. */
  async tasksFromText(
    ctx: PermissionContext,
    dto: AiTasksFromTextDto,
  ): Promise<AiTaskProposalResult> {
    await this.usage.assertAllowed(ctx.workspaceId, ctx.userId);
    await this.hierarchy.requireList(ctx, new Types.ObjectId(dto.listId), 'edit');

    const completion = await this.provider.complete({
      messages: [
        { role: 'system', content: tasksFromTextSystemPrompt() },
        { role: 'user', content: contextText(dto.text, MAX_AI_TEXT_LENGTH) },
      ],
      temperature: 0,
      responseFormat: 'json_object',
    });

    await this.usage.record({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      feature: 'tasksFromText',
      usage: completion.usage,
      model: completion.model,
    });

    const { tasks, warnings } = validateTaskProposal(this.parseJson(completion.content));

    if (tasks.length === 0) {
      throw new BadRequestException({
        code: 'AI_INVALID_PROPOSAL',
        message:
          `A IA não conseguiu montar tarefas a partir do texto. ${warnings.join(' ')}`.trim(),
      });
    }

    return { listId: dto.listId, tasks, warnings };
  }

  /** Creates what the user confirmed, validated again by the same schema. */
  async confirmTasks(
    ctx: PermissionContext,
    dto: ConfirmTasksFromTextDto,
  ): Promise<AiConfirmResult> {
    const { tasks, warnings } = validateTaskProposal({ tasks: dto.tasks });

    if (tasks.length === 0) {
      throw new BadRequestException({
        code: 'AI_INVALID_PROPOSAL',
        message: `Nenhuma tarefa válida na proposta. ${warnings.join(' ')}`.trim(),
      });
    }

    const listId = new Types.ObjectId(dto.listId);
    const taskPrefix = await this.taskPrefixOf(ctx.workspaceId);
    const created: TaskDocument[] = [];

    for (const task of tasks) {
      created.push(
        await this.tasks.create(ctx, listId, taskPrefix, {
          name: task.name,
          descriptionText: task.descriptionText,
          priority: task.priority,
          type: task.type,
          dueAt: task.dueAt,
          dueHasTime: task.dueAt !== undefined,
          estimateMinutes: task.estimateMinutes,
          points: task.points,
        }),
      );
    }

    return { listId: dto.listId, created };
  }

  async write(ctx: PermissionContext, dto: AiWriteDto): Promise<AiWriteResult> {
    await this.usage.assertAllowed(ctx.workspaceId, ctx.userId);

    const completion = await this.provider.complete({
      messages: [
        { role: 'system', content: writeSystemPrompt(dto.action) },
        { role: 'user', content: contextText(dto.text, MAX_AI_TEXT_LENGTH) },
      ],
      temperature: 0.2,
    });

    await this.usage.record({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      feature: 'write',
      usage: completion.usage,
      model: completion.model,
    });

    return { action: dto.action, text: completion.content.trim() };
  }

  /** Context of each entity, always read with the permission of the requester. */
  private async summaryContext(ctx: PermissionContext, dto: AiSummarizeDto): Promise<string> {
    const id = new Types.ObjectId(dto.id);

    switch (dto.entityType) {
      case 'task':
        return this.taskContext(ctx, dto.id);
      case 'thread':
        return this.threadContext(ctx, id);
      case 'channel':
        return this.channelContext(ctx, id);
      case 'doc':
        return this.docContext(ctx, id);
    }
  }

  private async taskContext(ctx: PermissionContext, idOrCustomId: string): Promise<string> {
    const task = await this.tasks.get(ctx, idOrCustomId);
    const threads = await this.comments.list(ctx, idOrCustomId, { limit: MAX_SUMMARY_ITEMS });
    const lines = [
      `Tarefa ${task.customId}: ${task.name}`,
      `Status: ${task.statusGroup} · Prioridade: ${task.priority ?? 'sem prioridade'} · Prazo: ${
        task.dueAt?.toISOString() ?? 'sem prazo'
      }`,
      `Descrição: ${task.descriptionText || 'sem descrição'}`,
      'Comentários:',
    ];

    for (const thread of threads.items) {
      lines.push(`- ${thread.comment.bodyText}`);

      for (const reply of thread.replies) {
        lines.push(`  - ${reply.bodyText}`);
      }
    }

    return contextText(lines.join('\n'), MAX_SUMMARY_CHARS);
  }

  private async threadContext(ctx: PermissionContext, messageId: Types.ObjectId): Promise<string> {
    const { message, channel } = await this.chat.requireMessage(ctx, messageId, 'view');
    const root = message.parentMessageId ?? message._id;
    const thread = await this.messages
      .find({
        workspaceId: ctx.workspaceId,
        deletedAt: null,
        $or: [{ _id: root }, { parentMessageId: root }],
      })
      .sort({ _id: 1 })
      .limit(MAX_SUMMARY_ITEMS)
      .exec();

    return contextText(
      [`Thread do canal ${channel.name || 'conversa'}:`, ...this.messageLines(thread)].join('\n'),
      MAX_SUMMARY_CHARS,
    );
  }

  private async channelContext(ctx: PermissionContext, channelId: Types.ObjectId): Promise<string> {
    const channel = await this.chat.requireChannel(ctx, channelId, 'view');
    const recent = await this.messages
      .find({ workspaceId: ctx.workspaceId, channelId: channel._id, deletedAt: null })
      .sort({ _id: -1 })
      .limit(MAX_SUMMARY_ITEMS)
      .exec();

    return contextText(
      [
        `Canal ${channel.name || 'conversa'} (mensagens mais recentes por último):`,
        ...this.messageLines(recent.reverse()),
      ].join('\n'),
      MAX_SUMMARY_CHARS,
    );
  }

  private async docContext(ctx: PermissionContext, docId: Types.ObjectId): Promise<string> {
    const doc = await this.docs.requireDoc(ctx, docId, 'view');
    const pages = await this.pages
      .find({ workspaceId: ctx.workspaceId, docId: doc._id })
      .sort({ position: 1 })
      .limit(MAX_SUMMARY_ITEMS)
      .exec();

    return contextText(
      [
        `Doc ${doc.title}:`,
        ...pages.map(
          (page) =>
            `## ${page.title}\n${truncate(page.contentText ?? '', MAX_CONTEXT_MESSAGE_CHARS)}`,
        ),
      ].join('\n'),
      MAX_SUMMARY_CHARS,
    );
  }

  private messageLines(messages: MessageDocument[]): string[] {
    return messages.map(
      (message) =>
        `- ${message._id.getTimestamp().toISOString()} ${truncate(
          message.bodyText,
          MAX_CONTEXT_MESSAGE_CHARS,
        )}`,
    );
  }

  private parseJson(content: string): unknown {
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');

    if (start === -1 || end <= start) {
      return null;
    }

    try {
      return JSON.parse(content.slice(start, end + 1));
    } catch {
      return null;
    }
  }

  private async taskPrefixOf(workspaceId: Types.ObjectId): Promise<string> {
    const workspace = await this.workspaces.findById(workspaceId).select('taskPrefix').exec();

    return workspace?.taskPrefix ?? 'TSK';
  }
}
