import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CursorPage, buildCursorPage, decodeObjectIdCursor } from '../../common/pagination/cursor';
import { DEFAULT_PAGE_SIZE } from '../../common/pagination/pagination-query.dto';
import { ChecklistsService } from '../collaboration/checklists.service';
import { Checklist, ChecklistItem } from '../collaboration/schemas/checklist.schema';
import { FoldersService } from '../hierarchy/folders.service';
import { Folder } from '../hierarchy/schemas/folder.schema';
import { HierarchyAccessService } from '../hierarchy/hierarchy-access.service';
import { ListsService } from '../hierarchy/lists.service';
import { PermissionContext } from '../hierarchy/permission.service';
import { FolderDocument } from '../hierarchy/schemas/folder.schema';
import { ListDocument } from '../hierarchy/schemas/list.schema';
import { SpaceDocument } from '../hierarchy/schemas/space.schema';
import { SpacesService } from '../hierarchy/spaces.service';
import { Task, TaskDocument } from '../tasks/schemas/task.schema';
import { TaskAccessService } from '../tasks/task-access.service';
import { TasksService } from '../tasks/tasks.service';
import { View, ViewDocument } from '../views/schemas/view.schema';
import { ViewConfigDto } from '../views/dto/view.dto';
import { DEFAULT_VIEWS } from '../views/view-types';
import { ViewsService } from '../views/views.service';
import { MAX_TEMPLATE_TASKS, TemplateType } from './automation-fields';
import { ApplyTemplateDto, CreateTemplateDto, TemplateQueryDto } from './dto/template.dto';
import { Template, TemplateDocument } from './schemas/template.schema';
import {
  ChecklistItemSnapshot,
  ChecklistSnapshot,
  FolderSnapshot,
  ListSnapshot,
  SpaceSnapshot,
  TaskSnapshot,
  ViewSnapshot,
  countTasks,
} from './template-content';
import { isoFromOffset, offsetMinutesOf } from './template-offsets';

/** What an automation knows about where to apply a template. */
export interface AutomationApplyTarget {
  listId: string | null;
  taskId: string | null;
  taskPrefix: string;
  anchor: Date;
}

/** The resource the applied template created. */
export type AppliedTemplate = Record<string, unknown>;

@Injectable()
export class TemplatesService {
  constructor(
    @InjectModel(Template.name) private readonly model: Model<Template>,
    @InjectModel(Task.name) private readonly tasks: Model<Task>,
    @InjectModel(Folder.name) private readonly folderModel: Model<Folder>,
    @InjectModel(Checklist.name) private readonly checklists: Model<Checklist>,
    @InjectModel(View.name) private readonly views: Model<View>,
    private readonly access: HierarchyAccessService,
    private readonly taskAccess: TaskAccessService,
    private readonly spaces: SpacesService,
    private readonly folders: FoldersService,
    private readonly lists: ListsService,
    private readonly tasksService: TasksService,
    private readonly checklistsService: ChecklistsService,
    private readonly viewsService: ViewsService,
  ) {}

  templateNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'TEMPLATE_NOT_FOUND',
      message: 'Template não encontrado.',
    });
  }

  /** Saves the source resource as a reusable snapshot. */
  async create(ctx: PermissionContext, dto: CreateTemplateDto): Promise<TemplateDocument> {
    const sourceId = new Types.ObjectId(dto.sourceId);
    const anchor = new Date();
    const content = await this.snapshot(ctx, dto.type, sourceId, anchor);

    return this.model.create({
      workspaceId: ctx.workspaceId,
      type: dto.type,
      name: dto.name,
      content: JSON.parse(JSON.stringify(content)) as Record<string, unknown>,
      createdBy: ctx.userId,
    });
  }

  async list(
    ctx: PermissionContext,
    query: TemplateQueryDto,
  ): Promise<CursorPage<TemplateDocument>> {
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const after = query.cursor ? decodeObjectIdCursor(query.cursor) : null;
    const base = {
      workspaceId: ctx.workspaceId,
      ...(query.type ? { type: query.type } : {}),
    };

    const docs = await this.model
      .find(after ? { ...base, _id: { $lt: after } } : base)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .exec();

    return buildCursorPage(docs, limit, (doc) => ({ id: String(doc._id) }));
  }

  async get(ctx: PermissionContext, templateId: Types.ObjectId): Promise<TemplateDocument> {
    const template = await this.model
      .findOne({ _id: templateId, workspaceId: ctx.workspaceId })
      .exec();

    if (!template) {
      throw this.templateNotFound();
    }

    return template;
  }

  async remove(ctx: PermissionContext, templateId: Types.ObjectId): Promise<void> {
    const template = await this.get(ctx, templateId);

    await this.model.deleteOne({ _id: template._id, workspaceId: ctx.workspaceId }).exec();
  }

  /**
   * Recreates the snapshot in the target location with brand-new ids and the
   * relative dates recalculated from the anchor. The creation services enforce the
   * permission of the target, so nothing extra is checked here.
   */
  async apply(
    ctx: PermissionContext,
    templateId: Types.ObjectId,
    taskPrefix: string,
    dto: ApplyTemplateDto,
  ): Promise<AppliedTemplate> {
    const template = await this.get(ctx, templateId);
    const anchor = dto.startAt ? new Date(dto.startAt) : new Date();
    const targetId = dto.targetId ? new Types.ObjectId(dto.targetId) : null;

    switch (template.type) {
      case 'space':
        return json(
          await this.applySpace(
            ctx,
            content<SpaceSnapshot>(template),
            dto.name,
            taskPrefix,
            anchor,
          ),
        );
      case 'folder':
        return json(
          await this.applyFolder(
            ctx,
            content<FolderSnapshot>(template),
            await this.requireTargetSpace(ctx, dto.targetType, targetId),
            dto.name,
            taskPrefix,
            anchor,
          ),
        );
      case 'list':
        return json(
          await this.applyListTo(ctx, content<ListSnapshot>(template), dto, taskPrefix, anchor),
        );
      case 'task':
        return json(
          await this.applyTask(
            ctx,
            content<TaskSnapshot>(template),
            await this.requireTargetList(ctx, dto.targetType, targetId),
            dto.name,
            taskPrefix,
            anchor,
            null,
          ),
        );
      case 'checklist':
        return await this.applyChecklist(
          ctx,
          content<ChecklistSnapshot>(template),
          await this.requireTargetTask(ctx, dto.targetType, targetId),
          dto.name,
        );
      case 'view':
        return json(await this.applyView(ctx, content<ViewSnapshot>(template), dto, targetId));
    }
  }

  /** Entry point of the applyTemplate action, which has no DTO to work from. */
  async applyForAutomation(
    ctx: PermissionContext,
    templateId: Types.ObjectId,
    target: AutomationApplyTarget,
  ): Promise<AppliedTemplate> {
    const template = await this.get(ctx, templateId);
    const dto: ApplyTemplateDto = { startAt: target.anchor.toISOString() };

    if (template.type === 'checklist') {
      if (!target.taskId) {
        throw this.invalidTarget('O template de checklist exige uma tarefa de destino.');
      }

      dto.targetType = 'task';
      dto.targetId = target.taskId;
    } else if (template.type === 'task' || template.type === 'view') {
      if (!target.listId) {
        throw this.invalidTarget('O template exige uma List de destino.');
      }

      dto.targetType = 'list';
      dto.targetId = target.listId;
    } else if (template.type === 'list' || template.type === 'folder') {
      const list = target.listId
        ? await this.lists.get(ctx, new Types.ObjectId(target.listId))
        : null;

      if (!list) {
        throw this.invalidTarget('O template exige uma List de referência.');
      }

      dto.targetType = list.folderId && template.type === 'list' ? 'folder' : 'space';
      dto.targetId = String(
        list.folderId && template.type === 'list' ? list.folderId : list.spaceId,
      );
    }

    return this.apply(ctx, templateId, target.taskPrefix, dto);
  }

  private async snapshot(
    ctx: PermissionContext,
    type: TemplateType,
    sourceId: Types.ObjectId,
    anchor: Date,
  ): Promise<unknown> {
    switch (type) {
      case 'space':
        return this.snapshotSpace(
          ctx,
          await this.access.requireSpace(ctx, sourceId, 'view'),
          anchor,
        );
      case 'folder':
        return this.snapshotFolder(
          ctx,
          await this.access.requireFolder(ctx, sourceId, 'view'),
          anchor,
        );
      case 'list':
        return this.snapshotList(ctx, await this.access.requireList(ctx, sourceId, 'view'), anchor);
      case 'task': {
        const { task } = await this.taskAccess.requireTask(ctx, String(sourceId), 'view');

        return this.snapshotTask(ctx, task, anchor);
      }
      case 'checklist': {
        const checklist = await this.checklists
          .findOne({ _id: sourceId, workspaceId: ctx.workspaceId })
          .exec();

        if (!checklist) {
          throw this.invalidSource('Checklist não encontrada.');
        }

        await this.taskAccess.requireTask(ctx, String(checklist.taskId), 'view');

        return snapshotChecklist(checklist.name, checklist.items);
      }
      case 'view': {
        const view = await this.viewsService.requireVisible(ctx, sourceId);

        return snapshotView(view);
      }
    }
  }

  private async snapshotSpace(
    ctx: PermissionContext,
    space: SpaceDocument,
    anchor: Date,
  ): Promise<SpaceSnapshot> {
    const snapshot: SpaceSnapshot = {
      name: space.name,
      color: space.color ?? null,
      icon: space.icon ?? null,
      private: space.private,
      folders: [],
      lists: [],
    };

    for (const folder of await this.childFolders(ctx, space._id, null)) {
      snapshot.folders.push(await this.snapshotFolder(ctx, folder, anchor));
    }

    for (const list of await this.access.visibleLists(ctx, {
      spaceId: space._id,
      folderId: null,
    })) {
      snapshot.lists.push(await this.snapshotList(ctx, list, anchor));
    }

    this.assertSize([...snapshot.folders.flatMap(folderLists), ...snapshot.lists]);

    return snapshot;
  }

  /** Direct children of a Space (parentFolderId null) or of a Folder. */
  private childFolders(
    ctx: PermissionContext,
    spaceId: Types.ObjectId,
    parentFolderId: Types.ObjectId | null,
  ): Promise<FolderDocument[]> {
    return this.folderModel
      .find({
        workspaceId: ctx.workspaceId,
        spaceId,
        parentFolderId,
        deletedAt: null,
        archivedAt: null,
      })
      .sort({ position: 1 })
      .exec();
  }

  private async snapshotFolder(
    ctx: PermissionContext,
    folder: FolderDocument,
    anchor: Date,
  ): Promise<FolderSnapshot> {
    const snapshot: FolderSnapshot = {
      name: folder.name,
      private: folder.private,
      folders: [],
      lists: [],
    };

    for (const child of await this.childFolders(ctx, folder.spaceId, folder._id)) {
      snapshot.folders.push(await this.snapshotFolder(ctx, child, anchor));
    }

    for (const list of await this.access.visibleLists(ctx, { folderId: folder._id })) {
      snapshot.lists.push(await this.snapshotList(ctx, list, anchor));
    }

    this.assertSize(folderLists(snapshot));

    return snapshot;
  }

  private async snapshotList(
    ctx: PermissionContext,
    list: ListDocument,
    anchor: Date,
  ): Promise<ListSnapshot> {
    const roots = await this.tasks
      .find({
        workspaceId: ctx.workspaceId,
        listId: list._id,
        parentTaskId: null,
        deletedAt: null,
        archivedAt: null,
      })
      .sort({ position: 1 })
      .limit(MAX_TEMPLATE_TASKS)
      .exec();

    const snapshot: ListSnapshot = {
      name: list.name,
      color: list.color ?? null,
      description: list.description ?? null,
      tasks: [],
      views: await this.snapshotViews(ctx, list),
    };

    for (const task of roots) {
      snapshot.tasks.push(await this.snapshotTask(ctx, task, anchor));
    }

    this.assertSize([snapshot]);

    return snapshot;
  }

  private async snapshotTask(
    ctx: PermissionContext,
    task: TaskDocument,
    anchor: Date,
  ): Promise<TaskSnapshot> {
    const checklists = await this.checklists
      .find({ workspaceId: ctx.workspaceId, taskId: task._id })
      .sort({ position: 1 })
      .exec();
    const subtasks = await this.tasks
      .find({ workspaceId: ctx.workspaceId, parentTaskId: task._id, deletedAt: null })
      .sort({ position: 1 })
      .exec();

    const snapshot: TaskSnapshot = {
      name: task.name,
      description: task.description,
      descriptionText: task.descriptionText,
      priority: task.priority,
      type: task.type,
      points: task.points,
      estimateMinutes: task.estimateMinutes,
      dueHasTime: task.dueHasTime,
      startOffsetMinutes: offsetMinutesOf(task.startAt, anchor),
      dueOffsetMinutes: offsetMinutesOf(task.dueAt, anchor),
      checklists: checklists.map((one) => snapshotChecklist(one.name, one.items)),
      subtasks: [],
    };

    for (const subtask of subtasks) {
      snapshot.subtasks.push(await this.snapshotTask(ctx, subtask, anchor));
    }

    return snapshot;
  }

  /** Views of the List except the ones the hierarchy recreates on its own. */
  private async snapshotViews(ctx: PermissionContext, list: ListDocument): Promise<ViewSnapshot[]> {
    const docs = await this.views
      .find({
        workspaceId: ctx.workspaceId,
        locationType: 'list',
        locationId: list._id,
        private: false,
      })
      .sort({ position: 1 })
      .exec();

    return docs
      .filter(
        (view) =>
          !DEFAULT_VIEWS.some((preset) => preset.type === view.type && preset.name === view.name),
      )
      .map(snapshotView);
  }

  private async applySpace(
    ctx: PermissionContext,
    snapshot: SpaceSnapshot,
    name: string | undefined,
    taskPrefix: string,
    anchor: Date,
  ): Promise<SpaceDocument> {
    const space = await this.spaces.create(ctx, {
      name: name ?? snapshot.name,
      color: snapshot.color ?? undefined,
      icon: snapshot.icon ?? undefined,
      private: snapshot.private,
    });

    for (const folder of snapshot.folders) {
      await this.applyFolder(ctx, folder, space, undefined, taskPrefix, anchor);
    }

    for (const list of snapshot.lists) {
      await this.applyList(ctx, list, space, null, undefined, taskPrefix, anchor);
    }

    return space;
  }

  private async applyFolder(
    ctx: PermissionContext,
    snapshot: FolderSnapshot,
    space: SpaceDocument,
    name: string | undefined,
    taskPrefix: string,
    anchor: Date,
  ): Promise<FolderDocument> {
    const folder = await this.folders.create(ctx, {
      spaceId: String(space._id),
      name: name ?? snapshot.name,
      private: snapshot.private,
    });

    for (const child of snapshot.folders ?? []) {
      await this.applyNestedFolder(ctx, child, space, folder, taskPrefix, anchor);
    }

    for (const list of snapshot.lists ?? []) {
      await this.applyList(ctx, list, space, folder, undefined, taskPrefix, anchor);
    }

    return folder;
  }

  /** A Folder inside another one; the hierarchy caps the nesting at this level. */
  private async applyNestedFolder(
    ctx: PermissionContext,
    snapshot: FolderSnapshot,
    space: SpaceDocument,
    parent: FolderDocument,
    taskPrefix: string,
    anchor: Date,
  ): Promise<void> {
    const folder = await this.folders.create(ctx, {
      spaceId: String(space._id),
      parentFolderId: String(parent._id),
      name: snapshot.name,
      private: snapshot.private,
    });

    for (const list of snapshot.lists ?? []) {
      await this.applyList(ctx, list, space, folder, undefined, taskPrefix, anchor);
    }
  }

  private async applyListTo(
    ctx: PermissionContext,
    snapshot: ListSnapshot,
    dto: ApplyTemplateDto,
    taskPrefix: string,
    anchor: Date,
  ): Promise<ListDocument> {
    const targetId = dto.targetId ? new Types.ObjectId(dto.targetId) : null;

    if (dto.targetType === 'folder') {
      const folder = await this.requireTargetFolder(ctx, targetId);
      const space = await this.access.requireSpace(ctx, folder.spaceId, 'view');

      return this.applyList(ctx, snapshot, space, folder, dto.name, taskPrefix, anchor);
    }

    const space = await this.requireTargetSpace(ctx, dto.targetType, targetId);

    return this.applyList(ctx, snapshot, space, null, dto.name, taskPrefix, anchor);
  }

  private async applyList(
    ctx: PermissionContext,
    snapshot: ListSnapshot,
    space: SpaceDocument,
    folder: FolderDocument | null,
    name: string | undefined,
    taskPrefix: string,
    anchor: Date,
  ): Promise<ListDocument> {
    const list = await this.lists.create(ctx, {
      spaceId: String(space._id),
      folderId: folder ? String(folder._id) : null,
      name: name ?? snapshot.name,
      color: snapshot.color ?? undefined,
      description: snapshot.description ?? undefined,
    });

    for (const task of snapshot.tasks ?? []) {
      await this.applyTask(ctx, task, list, undefined, taskPrefix, anchor, null);
    }

    for (const view of snapshot.views ?? []) {
      await this.viewsService.create(ctx, {
        locationType: 'list',
        locationId: String(list._id),
        type: view.type,
        name: view.name,
        config: view.config as ViewConfigDto,
        pinned: view.pinned,
      });
    }

    return list;
  }

  private async applyTask(
    ctx: PermissionContext,
    snapshot: TaskSnapshot,
    list: ListDocument,
    name: string | undefined,
    taskPrefix: string,
    anchor: Date,
    parentTaskId: string | null,
  ): Promise<TaskDocument> {
    const task = await this.tasksService.create(ctx, list._id, taskPrefix, {
      name: name ?? snapshot.name,
      description: snapshot.description ?? undefined,
      descriptionText: snapshot.descriptionText,
      priority: snapshot.priority,
      type: snapshot.type,
      points: snapshot.points,
      estimateMinutes: snapshot.estimateMinutes,
      dueHasTime: snapshot.dueHasTime,
      startAt: isoFromOffset(snapshot.startOffsetMinutes, anchor),
      dueAt: isoFromOffset(snapshot.dueOffsetMinutes, anchor),
      ...(parentTaskId ? { parentTaskId } : {}),
    });

    for (const checklist of snapshot.checklists ?? []) {
      await this.applyChecklist(ctx, checklist, task, undefined);
    }

    for (const subtask of snapshot.subtasks ?? []) {
      await this.applyTask(ctx, subtask, list, undefined, taskPrefix, anchor, String(task._id));
    }

    return task;
  }

  private async applyChecklist(
    ctx: PermissionContext,
    snapshot: ChecklistSnapshot,
    task: TaskDocument,
    name: string | undefined,
  ): Promise<Record<string, unknown>> {
    const created = await this.checklistsService.create(ctx, String(task._id), {
      name: name ?? snapshot.name,
    });

    for (const item of snapshot.items ?? []) {
      await this.applyChecklistItem(ctx, created._id, item, null);
    }

    const reloaded = await this.checklists.findById(created._id).exec();

    return json(reloaded ?? created);
  }

  private async applyChecklistItem(
    ctx: PermissionContext,
    checklistId: Types.ObjectId,
    snapshot: ChecklistItemSnapshot,
    parentItemId: string | null,
  ): Promise<void> {
    const checklist = await this.checklistsService.addItem(ctx, checklistId, {
      text: snapshot.text,
      ...(parentItemId ? { parentItemId } : {}),
    });
    const created = checklist.items[checklist.items.length - 1];

    for (const child of snapshot.children ?? []) {
      await this.applyChecklistItem(ctx, checklistId, child, String(created._id));
    }
  }

  private async applyView(
    ctx: PermissionContext,
    snapshot: ViewSnapshot,
    dto: ApplyTemplateDto,
    targetId: Types.ObjectId | null,
  ): Promise<ViewDocument> {
    if (!dto.targetType || dto.targetType === 'task' || !targetId) {
      throw this.invalidTarget('O template de view exige um Space, Folder ou List de destino.');
    }

    return this.viewsService.create(ctx, {
      locationType: dto.targetType,
      locationId: String(targetId),
      type: snapshot.type,
      name: dto.name ?? snapshot.name,
      config: snapshot.config as ViewConfigDto,
      pinned: snapshot.pinned,
    });
  }

  private async requireTargetSpace(
    ctx: PermissionContext,
    targetType: string | undefined,
    targetId: Types.ObjectId | null,
  ): Promise<SpaceDocument> {
    if (targetType !== 'space' || !targetId) {
      throw this.invalidTarget('Informe o Space de destino.');
    }

    return this.access.requireSpace(ctx, targetId, 'edit');
  }

  private async requireTargetFolder(
    ctx: PermissionContext,
    targetId: Types.ObjectId | null,
  ): Promise<FolderDocument> {
    if (!targetId) {
      throw this.invalidTarget('Informe o Folder de destino.');
    }

    return this.access.requireFolder(ctx, targetId, 'edit');
  }

  private async requireTargetList(
    ctx: PermissionContext,
    targetType: string | undefined,
    targetId: Types.ObjectId | null,
  ): Promise<ListDocument> {
    if (targetType !== 'list' || !targetId) {
      throw this.invalidTarget('Informe a List de destino.');
    }

    return this.access.requireList(ctx, targetId, 'edit');
  }

  private async requireTargetTask(
    ctx: PermissionContext,
    targetType: string | undefined,
    targetId: Types.ObjectId | null,
  ): Promise<TaskDocument> {
    if (targetType !== 'task' || !targetId) {
      throw this.invalidTarget('Informe a tarefa de destino.');
    }

    const { task } = await this.taskAccess.requireTask(ctx, String(targetId), 'edit');

    return task;
  }

  private assertSize(lists: ListSnapshot[]): void {
    const total = lists.reduce((sum, list) => sum + countTasks(list.tasks), 0);

    if (total > MAX_TEMPLATE_TASKS) {
      throw new BadRequestException({
        code: 'TEMPLATE_TOO_LARGE',
        message: `Um template carrega no máximo ${MAX_TEMPLATE_TASKS} tarefas.`,
      });
    }
  }

  private invalidSource(message: string): BadRequestException {
    return new BadRequestException({ code: 'INVALID_TEMPLATE_SOURCE', message });
  }

  private invalidTarget(message: string): BadRequestException {
    return new BadRequestException({ code: 'INVALID_TEMPLATE_TARGET', message });
  }
}

/** Mongoose documents do not carry an index signature; the API shape does. */
function json(doc: { toJSON(): unknown }): AppliedTemplate {
  return doc.toJSON() as AppliedTemplate;
}

function content<T>(template: TemplateDocument): T {
  return template.content as unknown as T;
}

/** Every List carried by the folder snapshot, nested folders included. */
function folderLists(folder: FolderSnapshot): ListSnapshot[] {
  return [...(folder.folders ?? []).flatMap(folderLists), ...(folder.lists ?? [])];
}

function snapshotView(view: ViewDocument): ViewSnapshot {
  return {
    type: view.type,
    name: view.name,
    config: view.config ?? {},
    pinned: view.pinned,
  };
}

/** Flattens the two levels of checklist items into a tree the apply can replay. */
function snapshotChecklist(name: string, items: ChecklistItem[]): ChecklistSnapshot {
  const roots = items.filter((item) => !item.parentItemId);

  return {
    name,
    items: roots.map((root) => ({
      text: root.text,
      children: items
        .filter((item) => String(item.parentItemId ?? '') === String(root._id))
        .map((child) => ({ text: child.text, children: [] })),
    })),
  };
}
