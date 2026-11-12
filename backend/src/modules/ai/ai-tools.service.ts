import { HttpException, Injectable, Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { HierarchyAccessService } from '../hierarchy/hierarchy-access.service';
import { PermissionContext } from '../hierarchy/permission.service';
import { TaskQueryDto } from '../tasks/dto/task-query.dto';
import { TaskDocument } from '../tasks/schemas/task.schema';
import { TaskQueryService } from '../tasks/task-query.service';
import { TasksService } from '../tasks/tasks.service';
import { contextText } from './ai-context';
import { MAX_CONTEXT_MESSAGE_CHARS, MAX_TOOL_ITEMS, AiToolName } from './ai-fields';
import { AiToolCall } from './ai-provider';

/** Shape of a task as the model sees it: no secrets, no internal ids beyond the keys. */
interface TaskSummary {
  id: string;
  customId: string;
  name: string;
  statusGroup: string;
  priority: string | null;
  dueAt: string | null;
  listId: string;
}

/**
 * Runs the tools of the assistant with the permission context of the requester.
 * A tool that cannot see the resource answers with an error code instead of
 * leaking its existence, exactly like the HTTP endpoints.
 */
@Injectable()
export class AiToolsService {
  private readonly logger = new Logger(AiToolsService.name);

  constructor(
    private readonly tasks: TasksService,
    private readonly queries: TaskQueryService,
    private readonly hierarchy: HierarchyAccessService,
  ) {}

  async run(
    ctx: PermissionContext,
    timeZone: string,
    call: AiToolCall,
  ): Promise<Record<string, unknown>> {
    const args = this.parseArguments(call.arguments);

    try {
      return await this.dispatch(ctx, timeZone, call.name as AiToolName, args);
    } catch (error) {
      if (error instanceof HttpException) {
        const payload = error.getResponse();
        const code =
          typeof payload === 'object' && payload !== null
            ? String((payload as Record<string, unknown>).code ?? 'ERROR')
            : 'ERROR';

        return { error: code };
      }

      this.logger.error(
        `Falha na ferramenta ${call.name}.`,
        error instanceof Error ? error.stack : String(error),
      );

      return { error: 'TOOL_FAILED' };
    }
  }

  private dispatch(
    ctx: PermissionContext,
    timeZone: string,
    name: AiToolName | string,
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    switch (name) {
      case 'search_tasks':
        return this.searchTasks(ctx, timeZone, args);
      case 'get_task':
        return this.getTask(ctx, args);
      case 'list_overdue':
        return this.listOverdue(ctx, timeZone, args);
      case 'summarize_list':
        return this.summarizeList(ctx, args);
      case 'my_tasks':
        return this.myTasks(ctx, timeZone);
      default:
        return Promise.resolve({ error: 'UNKNOWN_TOOL' });
    }
  }

  private async searchTasks(
    ctx: PermissionContext,
    timeZone: string,
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const q = this.text(args.query);

    if (!q) {
      return { error: 'MISSING_QUERY' };
    }

    const tasks = await this.page(ctx, timeZone, {
      location: 'everything',
      q,
      includeSubtasks: true,
      limit: this.limit(args.limit),
    });

    return { items: tasks.map((task) => this.summary(task)) };
  }

  private async getTask(
    ctx: PermissionContext,
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const idOrCustomId = this.text(args.idOrCustomId);

    if (!idOrCustomId) {
      return { error: 'MISSING_TASK' };
    }

    const task = await this.tasks.get(ctx, idOrCustomId);

    return {
      ...this.summary(task),
      descriptionText: contextText(task.descriptionText ?? '', MAX_CONTEXT_MESSAGE_CHARS),
      estimateMinutes: task.estimateMinutes,
      points: task.points,
      startAt: task.startAt?.toISOString() ?? null,
      closedAt: task.closedAt?.toISOString() ?? null,
    };
  }

  private async listOverdue(
    ctx: PermissionContext,
    timeZone: string,
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const listId = this.text(args.listId);
    const tasks = await this.page(ctx, timeZone, {
      location: listId ? 'list' : 'everything',
      locationId: listId,
      dueTo: new Date().toISOString(),
      includeSubtasks: true,
      sortBy: 'dueAt',
      limit: this.limit(args.limit),
    });

    return { items: tasks.map((task) => this.summary(task)) };
  }

  private async summarizeList(
    ctx: PermissionContext,
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const listId = this.text(args.listId);

    if (!listId || !Types.ObjectId.isValid(listId)) {
      return { error: 'LIST_NOT_FOUND' };
    }

    const list = await this.hierarchy.requireList(ctx, new Types.ObjectId(listId), 'view');
    const tasks = await this.queries.queryAll(ctx, {
      location: 'list',
      locationId: String(list._id),
      includeSubtasks: true,
      includeClosed: true,
    } as TaskQueryDto);
    const now = Date.now();
    const byStatusGroup: Record<string, number> = {};

    for (const task of tasks) {
      byStatusGroup[task.statusGroup] = (byStatusGroup[task.statusGroup] ?? 0) + 1;
    }

    const open = tasks.filter((task) => !['done', 'closed'].includes(task.statusGroup));

    return {
      list: { id: String(list._id), name: contextText(list.name, 200) },
      total: tasks.length,
      open: open.length,
      overdue: open.filter((task) => task.dueAt !== null && task.dueAt.getTime() < now).length,
      byStatusGroup,
      nextDue: open
        .filter((task) => task.dueAt !== null)
        .sort((one, other) => (one.dueAt?.getTime() ?? 0) - (other.dueAt?.getTime() ?? 0))
        .slice(0, 5)
        .map((task) => this.summary(task)),
    };
  }

  private async myTasks(
    ctx: PermissionContext,
    timeZone: string,
  ): Promise<Record<string, unknown>> {
    const result = await this.queries.myTasks(ctx, timeZone);

    return {
      timezone: result.timezone,
      sections: Object.fromEntries(
        Object.entries(result.sections).map(([section, tasks]) => [
          section,
          { total: tasks.length, items: tasks.slice(0, 5).map((task) => this.summary(task)) },
        ]),
      ),
    };
  }

  /** The query service answers a page of documents when nothing is grouped. */
  private page(
    ctx: PermissionContext,
    _timeZone: string,
    query: Partial<TaskQueryDto>,
  ): Promise<TaskDocument[]> {
    return this.queries.pageDocuments(ctx, query as TaskQueryDto);
  }

  private summary(task: TaskDocument): TaskSummary {
    return {
      id: String(task._id),
      customId: task.customId,
      name: contextText(task.name, 300),
      statusGroup: task.statusGroup,
      priority: task.priority ?? null,
      dueAt: task.dueAt?.toISOString() ?? null,
      listId: String(task.listId),
    };
  }

  private parseArguments(raw: string): Record<string, unknown> {
    try {
      const parsed: unknown = JSON.parse(raw || '{}');

      return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  private text(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const clean = value.trim();

    return clean.length === 0 ? undefined : clean;
  }

  private limit(value: unknown): number {
    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed < 1) {
      return MAX_TOOL_ITEMS;
    }

    return Math.min(Math.trunc(parsed), MAX_TOOL_ITEMS);
  }
}
