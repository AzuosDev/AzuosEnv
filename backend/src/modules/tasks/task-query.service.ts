import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CursorPage, decodeCursor, encodeCursor } from '../../common/pagination/cursor';
import { DEFAULT_PAGE_SIZE } from '../../common/pagination/pagination-query.dto';
import { escapeRegex } from '../../common/utils/regex';
import { safeTimeZone } from '../../common/utils/timezone';
import { CustomFieldsService } from '../fields/custom-fields.service';
import {
  CustomFieldIndex,
  fieldSortKey,
  fieldValueMap,
  matchesFieldFilters,
} from '../fields/field-values';
import { PermissionContext } from '../hierarchy/permission.service';
import { StatusSetsService } from '../hierarchy/status-sets.service';
import { UsersService } from '../users/users.service';
import { TaskGroupBy, TaskQueryDto, TaskSortBy } from './dto/task-query.dto';
import { Task, TaskDocument } from './schemas/task.schema';
import { TaskAccessService } from './task-access.service';
import {
  DUE_BUCKETS,
  DUE_BUCKET_LABELS,
  DayWindow,
  DueBucket,
  compareByKey,
  dayWindow,
  dueBucket,
  isAfterCursor,
  sortKeyOf,
} from './task-grouping';
import { PRIORITY_LABELS, TASK_PRIORITIES, priorityRank } from './task-fields';

/** Hard cap on the documents a single query scans before paging in memory. */
const MAX_QUERY_SCAN = 5000;

const UNASSIGNED = 'unassigned';

interface DocumentGroup {
  key: string;
  label: string;
  items: TaskDocument[];
  nextCursor: string | null;
}

interface DocumentGroups {
  groups: DocumentGroup[];
}

/** Resumo de subtarefas que a Lista e o Quadro mostram em cada linha. */
export interface SubtaskSummary {
  subtaskCount: number;
  subtaskDoneCount: number;
}

/** Tarefa serializada com o resumo de subtarefas. */
export type TaskListItem = Record<string, unknown> & SubtaskSummary;

export interface TaskGroup {
  key: string;
  label: string;
  items: TaskListItem[];
  nextCursor: string | null;
}

export interface GroupedTasks {
  groups: TaskGroup[];
}

export type TaskQueryResult = CursorPage<TaskListItem> | GroupedTasks;

export interface MyTasksResult {
  timezone: string;
  sections: Record<DueBucket, TaskDocument[]>;
}

interface SortedTask {
  key: string;
  id: string;
  task: TaskDocument;
}

interface QueryCursor {
  key: string;
  id: string;
  group?: string;
}

@Injectable()
export class TaskQueryService {
  constructor(
    @InjectModel(Task.name) private readonly model: Model<Task>,
    private readonly taskAccess: TaskAccessService,
    private readonly statusSets: StatusSetsService,
    private readonly users: UsersService,
    private readonly fields: CustomFieldsService,
  ) {}

  /** Serves List, Board, Calendar, Table and Gantt; always filtered by permission. */
  async query(
    ctx: PermissionContext,
    query: TaskQueryDto,
    timeZone: string,
  ): Promise<TaskQueryResult> {
    const groupBy = query.groupBy ?? 'none';
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const cursor = query.cursor ? this.decode(query.cursor) : null;
    const sorted = await this.sorted(ctx, query);

    if (groupBy === 'none') {
      const page = this.page(sorted, limit, cursor);
      const summaries = await this.subtaskSummaries(ctx, page.items);

      return {
        items: page.items.map((task) => serialize(task, summaries)),
        nextCursor: page.nextCursor,
      };
    }

    const grouped = await this.group(ctx, sorted, { groupBy, limit, cursor, timeZone });
    const summaries = await this.subtaskSummaries(
      ctx,
      grouped.groups.flatMap((group) => group.items),
    );

    return {
      groups: grouped.groups.map((group) => ({
        ...group,
        items: group.items.map((task) => serialize(task, summaries)),
      })),
    };
  }

  /**
   * Página de documentos da consulta, para quem precisa da tarefa inteira em vez
   * do JSON das views (ferramentas da IA).
   */
  async pageDocuments(ctx: PermissionContext, query: TaskQueryDto): Promise<TaskDocument[]> {
    const sorted = await this.sorted(ctx, query);

    return this.page(
      sorted,
      query.limit ?? DEFAULT_PAGE_SIZE,
      query.cursor ? this.decode(query.cursor) : null,
    ).items;
  }

  /** Every task of the query, in order and without paging; used by the export. */
  async queryAll(ctx: PermissionContext, query: TaskQueryDto): Promise<TaskDocument[]> {
    return (await this.sorted(ctx, query)).map((item) => item.task);
  }

  /** Loads, filters by custom field and sorts the tasks of the query. */
  private async sorted(ctx: PermissionContext, query: TaskQueryDto): Promise<SortedTask[]> {
    const listIds = await this.taskAccess.visibleListIds(ctx, query.location, query.locationId);
    const fieldFilters = query.fieldFilters ?? [];
    const index =
      fieldFilters.length > 0 || query.sortBy === 'field'
        ? await this.fields.indexFor(ctx.workspaceId)
        : null;

    let tasks = await this.load(ctx, query, listIds);

    if (index && fieldFilters.length > 0) {
      tasks = tasks.filter((task) =>
        matchesFieldFilters(fieldValueMap(task.customFields, index), fieldFilters),
      );
    }

    return this.sort(tasks, query.sortBy ?? 'position', index, query.sortFieldId);
  }

  /** My Tasks: sections of the authenticated user in the timezone of the profile. */
  async myTasks(ctx: PermissionContext, timeZone: string): Promise<MyTasksResult> {
    const zone = safeTimeZone(timeZone);
    const window = dayWindow(new Date(), zone);
    const listIds = await this.taskAccess.visibleListIds(ctx, 'everything');
    const tasks = await this.model
      .find({
        workspaceId: ctx.workspaceId,
        listIds: { $in: listIds },
        assigneeIds: ctx.userId,
        deletedAt: null,
        archivedAt: null,
        statusGroup: { $nin: ['done', 'closed'] },
      })
      .sort({ dueAt: 1, position: 1 })
      .limit(MAX_QUERY_SCAN)
      .exec();

    const sections: Record<DueBucket, TaskDocument[]> = {
      overdue: [],
      today: [],
      next7: [],
      later: [],
      noDate: [],
    };

    for (const task of tasks) {
      sections[dueBucket(task.dueAt, window)].push(task);
    }

    return { timezone: zone, sections };
  }

  private async load(
    ctx: PermissionContext,
    query: TaskQueryDto,
    listIds: Types.ObjectId[],
  ): Promise<TaskDocument[]> {
    if (listIds.length === 0) {
      return [];
    }

    return this.model
      .find(this.filter(ctx, query, listIds))
      .limit(MAX_QUERY_SCAN)
      .exec();
  }

  private filter(
    ctx: PermissionContext,
    query: TaskQueryDto,
    listIds: Types.ObjectId[],
  ): Record<string, unknown> {
    const filter: Record<string, unknown> = {
      workspaceId: ctx.workspaceId,
      listIds: { $in: listIds },
      deletedAt: null,
      archivedAt: null,
    };

    if (!query.includeSubtasks) {
      filter.parentTaskId = null;
    }

    if (query.statusIds?.length) {
      filter.statusId = { $in: query.statusIds.map((id) => new Types.ObjectId(id)) };
    }

    if (query.statusGroups?.length) {
      filter.statusGroup = { $in: query.statusGroups };
    } else if (!query.includeClosed) {
      filter.statusGroup = { $nin: ['done', 'closed'] };
    }

    const assigneeIds = [
      ...(query.assigneeIds ?? []).map((id) => new Types.ObjectId(id)),
      ...(query.me ? [ctx.userId] : []),
    ];

    if (assigneeIds.length > 0) {
      filter.assigneeIds = { $in: assigneeIds };
    }

    if (query.priority?.length) {
      filter.priority = { $in: query.priority };
    }

    if (query.tagIds?.length) {
      filter.tagIds = { $in: query.tagIds.map((id) => new Types.ObjectId(id)) };
    }

    const dueAt = range(query.dueFrom, query.dueTo);

    if (dueAt) {
      filter.dueAt = dueAt;
    }

    const startAt = range(query.startFrom, query.startTo);

    if (startAt) {
      filter.startAt = startAt;
    }

    if (query.q) {
      const search = new RegExp(escapeRegex(query.q), 'i');

      filter.$or = [{ name: search }, { customId: search }];
    }

    return filter;
  }

  private sort(
    tasks: TaskDocument[],
    sortBy: TaskSortBy,
    index: CustomFieldIndex | null,
    sortFieldId?: string,
  ): SortedTask[] {
    const keyOf =
      sortBy === 'field' && index && sortFieldId
        ? (task: TaskDocument) =>
            fieldSortKey(fieldValueMap(task.customFields, index).get(sortFieldId))
        : (task: TaskDocument) => sortKeyOf(task, sortBy);

    return tasks
      .map((task) => ({ key: keyOf(task), id: String(task._id), task }))
      .sort(compareByKey);
  }

  private page(
    sorted: SortedTask[],
    limit: number,
    cursor: QueryCursor | null,
    group?: string,
  ): CursorPage<TaskDocument> {
    const pending = cursor ? sorted.filter((item) => isAfterCursor(item, cursor)) : sorted;
    const items = pending.slice(0, limit);
    const last = items[items.length - 1];

    return {
      items: items.map((item) => item.task),
      nextCursor:
        pending.length > limit && last
          ? encodeCursor({ key: last.key, id: last.id, ...(group ? { group } : {}) })
          : null,
    };
  }

  /** Quantas subtarefas cada tarefa da página tem e quantas já fecharam. */
  private async subtaskSummaries(
    ctx: PermissionContext,
    tasks: TaskDocument[],
  ): Promise<Map<string, SubtaskSummary>> {
    const parentIds = tasks.map((task) => task._id);

    if (parentIds.length === 0) {
      return new Map();
    }

    const rows = await this.model
      .aggregate<{ _id: Types.ObjectId; total: number; done: number }>([
        {
          $match: {
            workspaceId: ctx.workspaceId,
            parentTaskId: { $in: parentIds },
            deletedAt: null,
            archivedAt: null,
          },
        },
        {
          $group: {
            _id: '$parentTaskId',
            total: { $sum: 1 },
            done: { $sum: { $cond: [{ $in: ['$statusGroup', ['done', 'closed']] }, 1, 0] } },
          },
        },
      ])
      .exec();

    return new Map(
      rows.map((row) => [String(row._id), { subtaskCount: row.total, subtaskDoneCount: row.done }]),
    );
  }

  private async group(
    ctx: PermissionContext,
    sorted: SortedTask[],
    options: {
      groupBy: Exclude<TaskGroupBy, 'none'>;
      limit: number;
      cursor: QueryCursor | null;
      timeZone: string;
    },
  ): Promise<DocumentGroups> {
    const window = dayWindow(new Date(), safeTimeZone(options.timeZone));
    const buckets = new Map<string, SortedTask[]>();

    for (const item of sorted) {
      for (const key of this.groupKeys(item.task, options.groupBy, window)) {
        const bucket = buckets.get(key) ?? [];

        bucket.push(item);
        buckets.set(key, bucket);
      }
    }

    const meta = await this.groupMeta(ctx, options.groupBy, [...buckets.keys()]);
    const keys = [...buckets.keys()].sort((a, b) => compareMeta(meta, a, b));
    const group = options.cursor?.group;
    const selected = group ? keys.filter((key) => key === group) : keys;

    return {
      groups: selected.map((key) => {
        const page = this.page(buckets.get(key) ?? [], options.limit, options.cursor, key);

        return {
          key,
          label: meta.get(key)?.label ?? key,
          items: page.items,
          nextCursor: page.nextCursor,
        };
      }),
    };
  }

  private groupKeys(
    task: TaskDocument,
    groupBy: Exclude<TaskGroupBy, 'none'>,
    window: DayWindow,
  ): string[] {
    if (groupBy === 'status') {
      return [String(task.statusId)];
    }

    if (groupBy === 'assignee') {
      return task.assigneeIds.length > 0 ? task.assigneeIds.map(String) : [UNASSIGNED];
    }

    if (groupBy === 'priority') {
      return [task.priority ?? 'none'];
    }

    return [dueBucket(task.dueAt, window)];
  }

  /** Label and order of each group: status position, priority rank, bucket order. */
  private async groupMeta(
    ctx: PermissionContext,
    groupBy: Exclude<TaskGroupBy, 'none'>,
    keys: string[],
  ): Promise<Map<string, GroupMeta>> {
    if (groupBy === 'status') {
      const statuses = await this.statusSets.statusIndex(ctx.workspaceId);

      return new Map(
        keys.map((key) => [
          key,
          {
            label: statuses.get(key)?.name ?? 'Status removido',
            order: statuses.get(key)?.position ?? Number.MAX_SAFE_INTEGER,
          },
        ]),
      );
    }

    if (groupBy === 'assignee') {
      const names = await this.users.namesByIds(
        keys.filter((key) => key !== UNASSIGNED).map((key) => new Types.ObjectId(key)),
      );

      return new Map(
        keys.map((key) => [
          key,
          key === UNASSIGNED
            ? { label: 'Sem responsável', order: 1 }
            : { label: names.get(key) ?? 'Usuário removido', order: 0 },
        ]),
      );
    }

    if (groupBy === 'priority') {
      return new Map(
        keys.map((key) => [
          key,
          {
            label: PRIORITY_LABELS[key as keyof typeof PRIORITY_LABELS] ?? key,
            order: priorityRank(TASK_PRIORITIES.find((priority) => priority === key)),
          },
        ]),
      );
    }

    return new Map(
      keys.map((key) => [
        key,
        {
          label: DUE_BUCKET_LABELS[key as DueBucket] ?? key,
          order: DUE_BUCKETS.indexOf(key as DueBucket),
        },
      ]),
    );
  }

  private decode(cursor: string): QueryCursor {
    const payload = decodeCursor(cursor);

    if (typeof payload.key !== 'string' || typeof payload.id !== 'string') {
      throw new BadRequestException({ code: 'INVALID_CURSOR', message: 'Cursor inválido.' });
    }

    return {
      key: payload.key,
      id: payload.id,
      group: typeof payload.group === 'string' ? payload.group : undefined,
    };
  }
}

interface GroupMeta {
  label: string;
  order: number;
}

const NO_SUBTASKS: SubtaskSummary = { subtaskCount: 0, subtaskDoneCount: 0 };

/** Tarefa em JSON com o resumo de subtarefas ao lado. */
function serialize(task: TaskDocument, summaries: Map<string, SubtaskSummary>): TaskListItem {
  return {
    ...(task.toJSON() as unknown as Record<string, unknown>),
    ...(summaries.get(String(task._id)) ?? NO_SUBTASKS),
  };
}

function compareMeta(meta: Map<string, GroupMeta>, a: string, b: string): number {
  const left = meta.get(a);
  const right = meta.get(b);

  if (left && right && left.order !== right.order) {
    return left.order - right.order;
  }

  return (left?.label ?? a).localeCompare(right?.label ?? b, 'pt-BR');
}

function range(from?: string, to?: string): Record<string, Date> | null {
  const filter: Record<string, Date> = {};

  if (from) {
    filter.$gte = new Date(from);
  }

  if (to) {
    filter.$lte = new Date(to);
  }

  return Object.keys(filter).length > 0 ? filter : null;
}
