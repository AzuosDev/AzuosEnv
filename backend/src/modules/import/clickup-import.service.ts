import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AttachmentsService, type UploadedFile } from '../collaboration/attachments.service';
import { ChecklistsService } from '../collaboration/checklists.service';
import { MAX_UPLOAD_BYTES } from '../collaboration/collaboration-fields';
import { CommentsService } from '../collaboration/comments.service';
import { CreateCustomFieldDto } from '../fields/dto/custom-field.dto';
import { CustomFieldsService } from '../fields/custom-fields.service';
import { FoldersService } from '../hierarchy/folders.service';
import { HierarchyAccessService } from '../hierarchy/hierarchy-access.service';
import { ListsService } from '../hierarchy/lists.service';
import { PermissionContext } from '../hierarchy/permission.service';
import { CreateStatusSetDto } from '../hierarchy/dto/status-set.dto';
import { Folder, FolderDocument } from '../hierarchy/schemas/folder.schema';
import { List, ListDocument } from '../hierarchy/schemas/list.schema';
import { Space, SpaceDocument } from '../hierarchy/schemas/space.schema';
import { StatusSetsService } from '../hierarchy/status-sets.service';
import { Tag } from '../tasks/schemas/tag.schema';
import { Task, TaskDocument } from '../tasks/schemas/task.schema';
import { TagsService } from '../tasks/tags.service';
import { TasksService } from '../tasks/tasks.service';
import { TimeEntriesService } from '../time/time-entries.service';
import { MembersService } from '../workspaces/members.service';
import { SpacesService } from '../hierarchy/spaces.service';
import { ClickUpTask, SkippedRow, parseClickUpCsv } from './clickup-csv';
import { ImportClickUpDto } from './dto/import-clickup.dto';

export interface ImportReport {
  rows: number;
  tasks: number;
  lists: number;
  folders: number;
  spaces: number;
  tags: number;
  skipped: SkippedRow[];
  warnings: SkippedRow[];
}

export interface ImportFile {
  originalname?: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
}

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const MAX_WARNINGS = 200;
const MAX_ATTACHMENT_BYTES = MAX_UPLOAD_BYTES;
const ATTACHMENT_TIMEOUT_MS = 12_000;

interface PreparedRow {
  row: ClickUpTask;
  space: SpaceDocument;
  folder: FolderDocument | null;
  list: ListDocument;
}

@Injectable()
export class ClickUpImportService {
  private readonly logger = new Logger(ClickUpImportService.name);

  constructor(
    @InjectModel(List.name) private readonly lists: Model<List>,
    @InjectModel(Folder.name) private readonly folders: Model<Folder>,
    @InjectModel(Space.name) private readonly spaces: Model<Space>,
    @InjectModel(Task.name) private readonly taskModel: Model<Task>,
    @InjectModel(Tag.name) private readonly tags: Model<Tag>,
    private readonly hierarchy: HierarchyAccessService,
    private readonly spacesService: SpacesService,
    private readonly listsService: ListsService,
    private readonly foldersService: FoldersService,
    private readonly tagsService: TagsService,
    private readonly tasksService: TasksService,
    private readonly statusSets: StatusSetsService,
    private readonly members: MembersService,
    private readonly fields: CustomFieldsService,
    private readonly checklists: ChecklistsService,
    private readonly comments: CommentsService,
    private readonly attachments: AttachmentsService,
    private readonly timeEntries: TimeEntriesService,
  ) {}

  async importCsv(
    ctx: PermissionContext,
    dto: ImportClickUpDto,
    taskPrefix: string,
    file: ImportFile | undefined,
  ): Promise<ImportReport> {
    const content = this.readFile(file);
    const { tasks, skipped } = parseClickUpCsv(content);
    const report: ImportReport = {
      rows: tasks.length + skipped.length,
      tasks: 0,
      lists: 0,
      folders: 0,
      spaces: 0,
      tags: 0,
      skipped,
      warnings: [],
    };
    const overrideSpace = dto.spaceId
      ? await this.hierarchy.requireSpace(ctx, new Types.ObjectId(dto.spaceId), 'edit')
      : null;
    const spaceCache = new Map<string, SpaceDocument>();
    const folderCache = new Map<string, FolderDocument>();
    const listCache = new Map<string, ListDocument>();
    const tagCache = new Map<string, Types.ObjectId>();
    const prepared: PreparedRow[] = [];

    for (const row of tasks) {
      try {
        const space =
          overrideSpace ?? (await this.ensureSpace(ctx, row.spaceName, spaceCache, report));
        const folder = await this.ensureFolderPath(
          ctx,
          space._id,
          row.folderPath,
          folderCache,
          report,
        );
        const list = await this.ensureList(ctx, space._id, folder, row, listCache, report);
        prepared.push({ row, space, folder, list });
      } catch (error: unknown) {
        skipped.push({ line: row.line, reason: messageOf(error) });
      }
    }

    const preparedByExternalId = new Map(
      prepared
        .filter((entry) => entry.row.externalId)
        .map((entry) => [entry.row.externalId, entry]),
    );
    for (const entry of prepared) {
      const parent = preparedByExternalId.get(entry.row.parentExternalId);
      if (parent) {
        entry.space = parent.space;
        entry.folder = parent.folder;
        entry.list = parent.list;
      }
    }

    const byList = groupBy(prepared, (entry) => String(entry.list._id));
    const clickupFields = new Map<string, Types.ObjectId>();
    for (const [listId, entries] of byList) {
      const list = entries[0]!.list;
      const names = uniqueNames(entries.map(({ row }) => row.statusName));
      await this.ensureListStatuses(ctx, list, names);
      clickupFields.set(listId, await this.ensureClickUpField(ctx, list));
    }

    const identities = await this.activeMembers(ctx);
    const existing = await this.existingTasks(ctx, tasks);
    const importedIds = new Map<string, Types.ObjectId>(
      [...existing].map(([externalId, task]) => [externalId, task._id]),
    );
    const ordered = parentFirst(prepared.map((entry) => entry.row));
    const preparedByRow = new Map(prepared.map((entry) => [entry.row, entry]));

    for (const row of ordered) {
      const target = preparedByRow.get(row);
      if (!target) continue;
      if (row.externalId && importedIds.has(row.externalId)) {
        pushWarning(report.warnings, { line: row.line, reason: `JÁ IMPORTADA: ${row.externalId}` });
        continue;
      }
      try {
        const statusId = await this.resolveStatus(
          target.list,
          row.statusName,
          report.warnings,
          row.line,
        );
        const tagIds = await this.resolveTags(ctx, target.space._id, row, tagCache, report);
        const assigneeIds = resolvePeople(row, identities, report.warnings);
        const parentId = row.parentExternalId ? importedIds.get(row.parentExternalId) : undefined;
        const customFieldId = clickupFields.get(String(target.list._id));
        const task = await this.tasksService.create(ctx, target.list._id, taskPrefix, {
          name: row.name,
          descriptionText: row.descriptionText || undefined,
          statusId,
          priority: row.priority,
          assigneeIds: assigneeIds.map(String),
          tagIds: tagIds.map(String),
          startAt: row.startAt,
          dueAt: row.dueAt,
          dueHasTime: false,
          estimateMinutes: row.estimateMinutes,
          points: row.points,
          parentTaskId: parentId ? String(parentId) : undefined,
          externalId: row.externalId || undefined,
          customFields:
            row.externalId && customFieldId
              ? [{ fieldId: String(customFieldId), value: row.externalId }]
              : undefined,
        });
        if (row.externalId) importedIds.set(row.externalId, task._id);
        await this.preserveTaskDates(ctx, task, row);
        report.tasks += 1;
        await this.importChecklists(ctx, task, row, report.warnings);
        await this.importComments(ctx, task, row, identities, report.warnings);
        await this.importTime(ctx, task, row, report.warnings);
        await this.importAttachments(ctx, task, row, report.warnings);
      } catch (error: unknown) {
        this.logger.warn(`Linha ${row.line} do CSV ignorada: ${messageOf(error)}`);
        skipped.push({ line: row.line, reason: messageOf(error) });
      }
    }

    return report;
  }

  private readFile(file: ImportFile | undefined): string {
    if (!file?.buffer || file.buffer.length === 0) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'Envie o CSV exportado do ClickUp.',
      });
    }
    if (file.buffer.length > MAX_IMPORT_BYTES) {
      throw new BadRequestException({ code: 'FILE_TOO_LARGE', message: 'O arquivo excede 5 MB.' });
    }
    return file.buffer.toString('utf8');
  }

  private async ensureSpace(
    ctx: PermissionContext,
    name: string,
    cache: Map<string, SpaceDocument>,
    report: ImportReport,
  ): Promise<SpaceDocument> {
    if (!name) throw new BadRequestException('SPACE_NAME_REQUIRED');
    const key = normalize(name);
    const cached = cache.get(key);
    if (cached) return cached;
    const spaces = await this.spaces
      .find({ workspaceId: ctx.workspaceId, archivedAt: null })
      .exec();
    const existing = spaces.find((space) => normalize(space.name) === key);
    const space = existing ?? (await this.spacesService.create(ctx, { name: name.slice(0, 80) }));
    if (!existing) report.spaces += 1;
    cache.set(key, space);
    return space;
  }

  private async ensureFolderPath(
    ctx: PermissionContext,
    spaceId: Types.ObjectId,
    path: string[],
    cache: Map<string, FolderDocument>,
    report: ImportReport,
  ): Promise<FolderDocument | null> {
    let parent: FolderDocument | null = null;
    for (const rawName of path) {
      const name = rawName.trim().slice(0, 80);
      if (!name) continue;
      const key = `${spaceId}:${String(parent?._id ?? 'root')}:${normalize(name)}`;
      const cached = cache.get(key);
      if (cached) {
        parent = cached;
        continue;
      }
      const siblingFolders: FolderDocument[] = await this.folders
        .find({
          workspaceId: ctx.workspaceId,
          spaceId,
          parentFolderId: parent?._id ?? null,
          deletedAt: null,
        })
        .exec();
      const existingFolder = siblingFolders.find(
        (candidate) => normalize(candidate.name) === normalize(name),
      );
      const folder: FolderDocument =
        existingFolder ??
        (await this.foldersService.create(ctx, {
          spaceId: String(spaceId),
          parentFolderId: parent ? String(parent._id) : null,
          name,
        }));
      if (!existingFolder) report.folders += 1;
      cache.set(key, folder);
      parent = folder;
    }
    return parent;
  }

  private async ensureList(
    ctx: PermissionContext,
    spaceId: Types.ObjectId,
    folder: FolderDocument | null,
    row: ClickUpTask,
    cache: Map<string, ListDocument>,
    report: ImportReport,
  ): Promise<ListDocument> {
    const key = `${spaceId}:${String(folder?._id ?? 'root')}:${normalize(row.listName)}`;
    const cached = cache.get(key);
    if (cached) return cached;
    const siblingLists: ListDocument[] = await this.lists
      .find({
        workspaceId: ctx.workspaceId,
        spaceId,
        folderId: folder?._id ?? null,
        deletedAt: null,
      })
      .exec();
    const existing = siblingLists.find(
      (candidate) => normalize(candidate.name) === normalize(row.listName),
    );
    const list =
      existing ??
      (await this.listsService.create(ctx, {
        spaceId: String(spaceId),
        folderId: folder ? String(folder._id) : null,
        name: row.listName.slice(0, 120),
      }));
    if (!existing) report.lists += 1;
    cache.set(key, list);
    return list;
  }

  private async ensureListStatuses(
    ctx: PermissionContext,
    list: ListDocument,
    names: string[],
  ): Promise<void> {
    if (names.length === 0) return;
    const current = await this.statusSets.resolveForList(list);
    if (
      names.every((name) =>
        current.statuses.some(
          (status) =>
            normalize(status.name) === normalize(name) && status.group === statusGroup(name),
        ),
      )
    )
      return;
    const statuses: CreateStatusSetDto['statuses'] = names.slice(0, 60).map((name) => ({
      name: name.slice(0, 60),
      color: statusColor(statusGroup(name)),
      group: statusGroup(name),
    }));
    const set = await this.statusSets.create(ctx.workspaceId, {
      name: `${list.name} (ClickUp)`.slice(0, 80),
      statuses,
    });
    await this.listsService.update(ctx, list._id, { statusSetId: String(set._id) });
    list.statusSetId = set._id;
  }

  private async ensureClickUpField(
    ctx: PermissionContext,
    list: ListDocument,
  ): Promise<Types.ObjectId> {
    const existing = (await this.fields.list(ctx, 'list', list._id)).find(
      (field) => normalize(field.name) === normalize('ID ClickUp'),
    );
    if (existing) return existing._id;
    const dto: CreateCustomFieldDto = {
      scope: 'list',
      scopeId: String(list._id),
      name: 'ID ClickUp',
      type: 'text',
    };
    return (await this.fields.create(ctx, dto))._id;
  }

  private async resolveStatus(
    list: ListDocument,
    name: string,
    warnings: SkippedRow[],
    line: number,
  ): Promise<string | undefined> {
    if (!name) return undefined;
    const effective = await this.statusSets.resolveForList(list);
    const match = effective.statuses.find((status) => normalize(status.name) === normalize(name));
    if (match) return String(match._id);
    pushWarning(warnings, { line, reason: `STATUS DESCONHECIDO: ${name}` });
    return effective.statuses.find((status) => statusGroup(status.name) !== 'done')?._id.toString();
  }

  private async resolveTags(
    ctx: PermissionContext,
    spaceId: Types.ObjectId,
    row: ClickUpTask,
    cache: Map<string, Types.ObjectId>,
    report: ImportReport,
  ): Promise<Types.ObjectId[]> {
    const ids: Types.ObjectId[] = [];
    for (const name of row.tagNames) {
      const key = `${spaceId}:${normalize(name)}`;
      const cached = cache.get(key);
      if (cached) {
        ids.push(cached);
        continue;
      }
      const existing = await this.tags
        .findOne({
          workspaceId: ctx.workspaceId,
          spaceId,
          name: new RegExp(`^${escapeRegExp(name)}$`, 'i'),
        })
        .exec();
      const tag =
        existing ??
        (await this.tagsService.create(ctx, { spaceId: String(spaceId), name: name.slice(0, 40) }));
      if (!existing) report.tags += 1;
      cache.set(key, tag._id);
      ids.push(tag._id);
    }
    return ids;
  }

  private async activeMembers(ctx: PermissionContext): Promise<Map<string, Types.ObjectId[]>> {
    const map = new Map<string, Types.ObjectId[]>();
    let cursor: string | undefined;
    do {
      const page = await this.members.list(ctx.workspaceId, { limit: 100, cursor });
      for (const member of page.items) {
        if (member.status !== 'active') continue;
        const user = member.userId as unknown as {
          _id?: Types.ObjectId;
          id?: string;
          name: string;
          email: string;
        };
        const id = user._id ?? new Types.ObjectId(user.id ?? member.userId.toString());
        for (const key of [normalize(user.name), normalize(user.email)]) {
          if (!key) continue;
          const values = map.get(key) ?? [];
          values.push(id);
          map.set(key, values);
        }
      }
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return map;
  }

  private async existingTasks(
    ctx: PermissionContext,
    rows: ClickUpTask[],
  ): Promise<Map<string, TaskDocument>> {
    const ids = [...new Set(rows.map((row) => row.externalId).filter(Boolean))];
    if (ids.length === 0) return new Map();
    const tasks = await this.taskModel
      .find({ workspaceId: ctx.workspaceId, externalId: { $in: ids } })
      .exec();
    return new Map(
      tasks.flatMap((task) => (task.externalId ? [[task.externalId, task] as const] : [])),
    );
  }

  private async preserveTaskDates(
    ctx: PermissionContext,
    task: TaskDocument,
    row: ClickUpTask,
  ): Promise<void> {
    const changes: Record<string, Date | null> = {};
    if (row.createdAt) changes.createdAt = new Date(row.createdAt);
    if (row.completedAt) changes.closedAt = new Date(row.completedAt);
    if (Object.keys(changes).length) {
      await this.taskModel.collection.updateOne(
        { _id: task._id, workspaceId: ctx.workspaceId },
        { $set: changes },
      );
    }
  }

  private async importChecklists(
    ctx: PermissionContext,
    task: TaskDocument,
    row: ClickUpTask,
    warnings: SkippedRow[],
  ): Promise<void> {
    for (const source of row.checklist) {
      try {
        const checklist = await this.checklists.create(ctx, task.customId, {
          name: source.name.slice(0, 200),
        });
        for (const text of source.items)
          await this.checklists.addItem(ctx, checklist._id, { text: text.slice(0, 1000) });
      } catch (error: unknown) {
        pushWarning(warnings, { line: row.line, reason: `CHECKLIST: ${messageOf(error)}` });
      }
    }
  }

  private async importComments(
    ctx: PermissionContext,
    task: TaskDocument,
    row: ClickUpTask,
    members: Map<string, Types.ObjectId[]>,
    warnings: SkippedRow[],
  ): Promise<void> {
    for (const source of row.comments) {
      const matches = members.get(normalize(source.by)) ?? [];
      const authorId = matches.length === 1 ? matches[0]! : new Types.ObjectId(ctx.userId);
      if (source.by && matches.length !== 1)
        pushWarning(warnings, {
          line: row.line,
          reason: `AUTOR DE COMENTÁRIO NÃO ENCONTRADO: ${source.by}`,
        });
      try {
        await this.comments.createImported(
          ctx,
          task.customId,
          { bodyText: source.text.slice(0, 20_000) },
          authorId,
          source.date ? new Date(source.date) : null,
          source.resolved,
        );
      } catch (error: unknown) {
        pushWarning(warnings, { line: row.line, reason: `COMENTÁRIO: ${messageOf(error)}` });
      }
    }
  }

  private async importTime(
    ctx: PermissionContext,
    task: TaskDocument,
    row: ClickUpTask,
    warnings: SkippedRow[],
  ): Promise<void> {
    let remaining = row.timeSpentMinutes ?? 0;
    let start = row.createdAt ? new Date(row.createdAt) : new Date();
    while (remaining > 0) {
      const durationMinutes = Math.min(remaining, 24 * 60);
      try {
        await this.timeEntries.create(ctx, {
          taskId: String(task._id),
          start: start.toISOString(),
          durationMinutes,
          note: 'Importado do ClickUp',
        });
      } catch (error: unknown) {
        pushWarning(warnings, { line: row.line, reason: `TEMPO: ${messageOf(error)}` });
        return;
      }
      remaining -= durationMinutes;
      start = new Date(start.getTime() + durationMinutes * 60_000);
    }
  }

  private async importAttachments(
    ctx: PermissionContext,
    task: TaskDocument,
    row: ClickUpTask,
    warnings: SkippedRow[],
  ): Promise<void> {
    const failed: string[] = [];
    for (const source of row.attachments) {
      try {
        const url = new URL(source.url);
        const response = await fetchAttachment(url);
        if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
        const length = Number(response.headers.get('content-length') ?? 0);
        if (length > MAX_ATTACHMENT_BYTES) throw new Error('arquivo acima de 25 MB');
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let size = 0;
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.byteLength;
          if (size > MAX_ATTACHMENT_BYTES) {
            await reader.cancel();
            throw new Error('arquivo acima de 25 MB');
          }
          chunks.push(part.value);
        }
        const upload: UploadedFile = {
          originalname: safeFilename(
            source.title || url.pathname.split('/').at(-1) || 'clickup-attachment',
          ),
          mimetype:
            response.headers.get('content-type')?.split(';')[0] || 'application/octet-stream',
          size,
          buffer: Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))),
        };
        await this.attachments.uploadToTask(ctx, task.customId, upload);
      } catch {
        failed.push(`${source.title}: ${source.url}`);
      }
    }
    if (failed.length) {
      pushWarning(warnings, {
        line: row.line,
        reason: `${failed.length} anexo(s) preservado(s) como link em comentário.`,
      });
      await this.comments.create(ctx, task.customId, {
        bodyText: `Anexos do ClickUp que não puderam ser baixados:\n${failed.join('\n')}`.slice(
          0,
          20_000,
        ),
      });
    }
  }
}

function resolvePeople(
  row: ClickUpTask,
  members: Map<string, Types.ObjectId[]>,
  warnings: SkippedRow[],
): Types.ObjectId[] {
  const result: Types.ObjectId[] = [];
  for (const person of row.assignees) {
    const matches = members.get(normalize(person)) ?? [];
    if (matches.length === 1) result.push(matches[0]!);
    else
      pushWarning(warnings, {
        line: row.line,
        reason: person.includes('@')
          ? `RESPONSAVEL SEM CONTA: ${person}`
          : `RESPONSÁVEL NÃO ENCONTRADO: ${person}`,
      });
  }
  return [...new Map(result.map((id) => [String(id), id])).values()];
}

function groupBy<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }
  return grouped;
}

function uniqueNames(values: string[]): string[] {
  return [
    ...new Map(values.filter(Boolean).map((value) => [normalize(value), value.trim()])).values(),
  ];
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase();
}

function statusGroup(name: string): 'notStarted' | 'active' | 'done' {
  const value = normalize(name);
  if (['complete', 'completed', 'done', 'closed', 'concluido', 'concluida'].includes(value))
    return 'done';
  if (['to do', 'todo', 'not started', 'open', 'a fazer', 'aberto'].includes(value))
    return 'notStarted';
  return 'active';
}

function statusColor(group: 'notStarted' | 'active' | 'done'): string {
  return group === 'done' ? '#16A34A' : group === 'notStarted' ? '#64748B' : '#2563EB';
}

function parentFirst(rows: ClickUpTask[]): ClickUpTask[] {
  const byId = new Map(rows.filter((row) => row.externalId).map((row) => [row.externalId, row]));
  const state = new Map<ClickUpTask, number>();
  const ordered: ClickUpTask[] = [];
  const visit = (row: ClickUpTask): void => {
    if (state.get(row) === 2) return;
    if (state.get(row) === 1) {
      row.parentExternalId = '';
      return;
    }
    state.set(row, 1);
    const parent = byId.get(row.parentExternalId);
    if (parent) visit(parent);
    state.set(row, 2);
    ordered.push(row);
  };
  rows.forEach(visit);
  return ordered;
}

function safeFilename(value: string): string {
  return value.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 180) || 'clickup-attachment';
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host === '::1' ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^(fc|fd|fe80):/i.test(host)
  );
}

async function fetchAttachment(initialUrl: URL): Promise<Response> {
  let url = initialUrl;
  for (let attempt = 0; attempt <= 4; attempt += 1) {
    if (!['http:', 'https:'].includes(url.protocol) || isPrivateHost(url.hostname)) {
      throw new Error('URL não pública');
    }
    const response = await fetch(url, {
      signal: AbortSignal.timeout(ATTACHMENT_TIMEOUT_MS),
      redirect: 'manual',
    });
    if (response.status < 300 || response.status >= 400) return response;
    const location = response.headers.get('location');
    if (!location || attempt === 4) throw new Error('redirecionamento inválido');
    url = new URL(location, url);
  }
  throw new Error('redirecionamento inválido');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pushWarning(warnings: SkippedRow[], warning: SkippedRow): void {
  if (warnings.length < MAX_WARNINGS) warnings.push(warning);
}

function messageOf(error: unknown): string {
  if (error instanceof NotFoundException || error instanceof BadRequestException) {
    const response = error.getResponse();
    if (typeof response === 'object' && response !== null && 'code' in response)
      return String((response as { code: unknown }).code);
  }
  return error instanceof Error ? error.message : String(error);
}
