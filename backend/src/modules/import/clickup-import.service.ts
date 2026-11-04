import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { FoldersService } from '../hierarchy/folders.service';
import { HierarchyAccessService } from '../hierarchy/hierarchy-access.service';
import { ListsService } from '../hierarchy/lists.service';
import { PermissionContext } from '../hierarchy/permission.service';
import { Folder, FolderDocument } from '../hierarchy/schemas/folder.schema';
import { List, ListDocument } from '../hierarchy/schemas/list.schema';
import { StatusSetsService } from '../hierarchy/status-sets.service';
import { Tag } from '../tasks/schemas/tag.schema';
import { TagsService } from '../tasks/tags.service';
import { TasksService } from '../tasks/tasks.service';
import { UsersService } from '../users/users.service';
import { MembersService } from '../workspaces/members.service';
import { ClickUpTask, SkippedRow, parseClickUpCsv } from './clickup-csv';
import { ImportClickUpDto } from './dto/import-clickup.dto';

export interface ImportReport {
  rows: number;
  tasks: number;
  lists: number;
  folders: number;
  tags: number;
  /** Rows that were not imported, with the reason. */
  skipped: SkippedRow[];
  /** Rows imported with something adjusted (unknown status, e-mail without account). */
  warnings: SkippedRow[];
}

export interface ImportFile {
  originalname?: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
}

/** A CSV bigger than this is refused before anything is parsed. */
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

const MAX_WARNINGS = 200;

@Injectable()
export class ClickUpImportService {
  private readonly logger = new Logger(ClickUpImportService.name);

  constructor(
    @InjectModel(List.name) private readonly lists: Model<List>,
    @InjectModel(Folder.name) private readonly folders: Model<Folder>,
    @InjectModel(Tag.name) private readonly tags: Model<Tag>,
    private readonly hierarchy: HierarchyAccessService,
    private readonly listsService: ListsService,
    private readonly foldersService: FoldersService,
    private readonly tagsService: TagsService,
    private readonly tasksService: TasksService,
    private readonly statusSets: StatusSetsService,
    private readonly users: UsersService,
    private readonly members: MembersService,
  ) {}

  /**
   * Recreates the Folders, Lists, tasks, statuses, assignees (matched by e-mail),
   * dates and tags of a CSV exported from ClickUp inside the given Space.
   */
  async importCsv(
    ctx: PermissionContext,
    dto: ImportClickUpDto,
    taskPrefix: string,
    file: ImportFile | undefined,
  ): Promise<ImportReport> {
    const content = this.readFile(file);
    const space = await this.hierarchy.requireSpace(ctx, new Types.ObjectId(dto.spaceId), 'edit');
    const { tasks, skipped } = parseClickUpCsv(content);
    const warnings: SkippedRow[] = [];
    const report: ImportReport = {
      rows: tasks.length + skipped.length,
      tasks: 0,
      lists: 0,
      folders: 0,
      tags: 0,
      skipped,
      warnings,
    };

    const emails = await this.resolveAssignees(ctx, tasks);
    const folderCache = new Map<string, FolderDocument | null>();
    const listCache = new Map<string, ListDocument>();
    const tagCache = new Map<string, Types.ObjectId>();

    for (const row of tasks) {
      try {
        const folder = await this.ensureFolder(ctx, space._id, row.folderName, folderCache, report);
        const list = await this.ensureList(ctx, space._id, folder, row, listCache, report);
        const statusId = await this.resolveStatus(list, row, warnings);
        const tagIds = await this.resolveTags(ctx, space._id, row, tagCache, report);

        await this.tasksService.create(ctx, list._id, taskPrefix, {
          name: row.name,
          descriptionText: row.descriptionText.length > 0 ? row.descriptionText : undefined,
          statusId,
          priority: row.priority,
          assigneeIds: this.resolveRowAssignees(row, emails, warnings),
          tagIds: tagIds.map((id) => String(id)),
          startAt: row.startAt,
          dueAt: row.dueAt,
          dueHasTime: false,
          estimateMinutes: row.estimateMinutes,
          points: row.points,
        });

        report.tasks += 1;
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
        message: 'Envie o arquivo CSV exportado do ClickUp no campo file.',
      });
    }

    if (file.buffer.length > MAX_IMPORT_BYTES) {
      throw new BadRequestException({ code: 'FILE_TOO_LARGE', message: 'O arquivo excede 5 MB.' });
    }

    return file.buffer.toString('utf8');
  }

  /** Active members of the workspace indexed by e-mail. */
  private async resolveAssignees(
    ctx: PermissionContext,
    tasks: ClickUpTask[],
  ): Promise<Map<string, Types.ObjectId>> {
    const wanted = [...new Set(tasks.flatMap((task) => task.assigneeEmails))];

    if (wanted.length === 0) {
      return new Map();
    }

    const users = await this.users.findManyByEmail(wanted);
    const active = new Set(
      (
        await this.members.activeUserIds(
          ctx.workspaceId,
          users.map((user) => user._id),
        )
      ).map((id) => String(id)),
    );

    return new Map(
      users
        .filter((user) => active.has(String(user._id)))
        .map((user) => [user.email.toLowerCase(), user._id] as const),
    );
  }

  private resolveRowAssignees(
    row: ClickUpTask,
    emails: Map<string, Types.ObjectId>,
    warnings: SkippedRow[],
  ): string[] {
    const ids: string[] = [];

    for (const email of row.assigneeEmails) {
      const userId = emails.get(email);

      if (userId) {
        ids.push(String(userId));

        continue;
      }

      pushWarning(warnings, { line: row.line, reason: `RESPONSAVEL SEM CONTA: ${email}` });
    }

    return ids;
  }

  private async ensureFolder(
    ctx: PermissionContext,
    spaceId: Types.ObjectId,
    name: string,
    cache: Map<string, FolderDocument | null>,
    report: ImportReport,
  ): Promise<FolderDocument | null> {
    if (name.length === 0) {
      return null;
    }

    const key = name.toLowerCase();
    const cached = cache.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const existing = await this.folders
      .findOne({ workspaceId: ctx.workspaceId, spaceId, name, deletedAt: null })
      .exec();

    if (existing) {
      cache.set(key, existing);

      return existing;
    }

    const created = await this.foldersService.create(ctx, {
      spaceId: String(spaceId),
      name: name.slice(0, 80),
    });

    report.folders += 1;
    cache.set(key, created);

    return created;
  }

  private async ensureList(
    ctx: PermissionContext,
    spaceId: Types.ObjectId,
    folder: FolderDocument | null,
    row: ClickUpTask,
    cache: Map<string, ListDocument>,
    report: ImportReport,
  ): Promise<ListDocument> {
    const key = `${String(folder?._id ?? 'root')}:${row.listName.toLowerCase()}`;
    const cached = cache.get(key);

    if (cached) {
      return cached;
    }

    const existing = await this.lists
      .findOne({
        workspaceId: ctx.workspaceId,
        spaceId,
        folderId: folder?._id ?? null,
        name: row.listName,
        deletedAt: null,
      })
      .exec();
    const list =
      existing ??
      (await this.listsService.create(ctx, {
        spaceId: String(spaceId),
        folderId: folder ? String(folder._id) : null,
        name: row.listName.slice(0, 120),
      }));

    if (!existing) {
      report.lists += 1;
    }

    cache.set(key, list);

    return list;
  }

  /** Status matched by name (case insensitive) in the status set of the List. */
  private async resolveStatus(
    list: ListDocument,
    row: ClickUpTask,
    warnings: SkippedRow[],
  ): Promise<string | undefined> {
    if (row.statusName.length === 0) {
      return undefined;
    }

    const effective = await this.statusSets.resolveForList(list);
    const match = effective.statuses.find(
      (status) => status.name.toLowerCase() === row.statusName.toLowerCase(),
    );

    if (!match) {
      pushWarning(warnings, { line: row.line, reason: `STATUS DESCONHECIDO: ${row.statusName}` });

      return undefined;
    }

    return String(match._id);
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
      const key = name.toLowerCase();
      const cached = cache.get(key);

      if (cached) {
        ids.push(cached);

        continue;
      }

      const existing = await this.tags
        .findOne({ workspaceId: ctx.workspaceId, spaceId, name })
        .exec();
      const tag =
        existing ??
        (await this.tagsService.create(ctx, { spaceId: String(spaceId), name: name.slice(0, 40) }));

      if (!existing) {
        report.tags += 1;
      }

      cache.set(key, tag._id);
      ids.push(tag._id);
    }

    return ids;
  }
}

function pushWarning(warnings: SkippedRow[], warning: SkippedRow): void {
  if (warnings.length < MAX_WARNINGS) {
    warnings.push(warning);
  }
}

function messageOf(error: unknown): string {
  if (error instanceof NotFoundException || error instanceof BadRequestException) {
    const response = error.getResponse();

    if (typeof response === 'object' && response !== null && 'code' in response) {
      return String((response as { code: unknown }).code);
    }
  }

  return error instanceof Error ? error.message : String(error);
}
