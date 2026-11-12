import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CursorPage, buildCursorPage, decodeObjectIdCursor } from '../../common/pagination/cursor';
import {
  DEFAULT_PAGE_SIZE,
  PaginationQueryDto,
} from '../../common/pagination/pagination-query.dto';
import { positionBetweenSiblings, positionedModel } from '../hierarchy/ordering';
import { PermissionContext } from '../hierarchy/permission.service';
import { Task } from '../tasks/schemas/task.schema';
import { TaskChanges } from '../tasks/task-events';
import { recordChange } from '../tasks/task-diff';
import { DocsAccessService } from './docs-access.service';
import { PAGE_CREATED, PAGE_UPDATED, PageCreatedEvent, PageUpdatedEvent } from './docs-events';
import { MAX_PAGE_DEPTH, MAX_PAGE_VERSIONS, PAGE_VERSION_INTERVAL_MS } from './docs-fields';
import { CreatePageDto, MovePageDto, UpdatePageDto } from './dto/doc-page.dto';
import { DocDocument } from './schemas/doc.schema';
import { DocPage, DocPageDocument, PageContent } from './schemas/doc-page.schema';
import { DocPageVersion, DocPageVersionDocument } from './schemas/doc-page-version.schema';

/** Content of a page at a point in time, as the snapshot stores it. */
interface PageState {
  version: number;
  title: string;
  content: PageContent;
  contentText: string;
  createdBy: Types.ObjectId;
}

/** The state being replaced; the snapshot keeps it, never the new content. */
function stateOf(page: DocPageDocument): PageState {
  return {
    version: page.version,
    title: page.title,
    content: page.content,
    contentText: page.contentText,
    createdBy: page.updatedBy,
  };
}

@Injectable()
export class DocPagesService {
  constructor(
    @InjectModel(DocPage.name) private readonly model: Model<DocPage>,
    @InjectModel(DocPageVersion.name) private readonly versions: Model<DocPageVersion>,
    @InjectModel(Task.name) private readonly tasks: Model<Task>,
    private readonly access: DocsAccessService,
    private readonly events: EventEmitter2,
  ) {}

  async create(
    ctx: PermissionContext,
    docId: Types.ObjectId,
    dto: CreatePageDto,
  ): Promise<DocPageDocument> {
    const doc = await this.access.requireDoc(ctx, docId, 'edit');
    const parentPageId = dto.parentPageId
      ? await this.requireParent(doc, new Types.ObjectId(dto.parentPageId))
      : null;

    const page = await this.model.create({
      workspaceId: doc.workspaceId,
      docId: doc._id,
      parentPageId,
      title: dto.title,
      content: dto.content ?? null,
      contentText: dto.contentText ?? '',
      mentionedTaskIds: await this.resolveTasks(ctx, dto.mentionedTaskIds),
      position: await positionBetweenSiblings(
        positionedModel(this.model),
        this.siblings(doc._id, parentPageId),
        dto.previousId ? new Types.ObjectId(dto.previousId) : null,
        dto.nextId ? new Types.ObjectId(dto.nextId) : null,
      ),
      version: 1,
      updatedBy: ctx.userId,
    });

    this.events.emit(PAGE_CREATED, this.baseEvent(ctx, page) satisfies PageCreatedEvent);

    return page;
  }

  get(ctx: PermissionContext, pageId: Types.ObjectId): Promise<DocPageDocument> {
    return this.access.requirePage(ctx, pageId, 'view').then(({ page }) => page);
  }

  /**
   * Saves with version control: the client sends the version it loaded and a
   * divergence answers 409, so two editors never overwrite each other silently.
   */
  async update(
    ctx: PermissionContext,
    pageId: Types.ObjectId,
    dto: UpdatePageDto,
  ): Promise<DocPageDocument> {
    const { page } = await this.access.requirePage(ctx, pageId, 'edit');

    if (dto.version !== page.version) {
      throw new ConflictException({
        code: 'PAGE_VERSION_CONFLICT',
        message: `A página foi alterada por outra pessoa (versão atual ${page.version}).`,
      });
    }

    const previous = stateOf(page);
    const changes: TaskChanges = {};

    if (dto.title !== undefined) {
      if (recordChange(changes, 'title', page.title, dto.title)) {
        page.title = dto.title;
      }
    }

    if (dto.content !== undefined) {
      const content = dto.content ?? null;

      if (recordChange(changes, 'content', page.content, content)) {
        page.content = content;
      }
    }

    if (
      dto.contentText !== undefined &&
      recordChange(changes, 'contentText', page.contentText, dto.contentText)
    ) {
      page.contentText = dto.contentText;
    }

    if (dto.mentionedTaskIds !== undefined) {
      const mentioned = await this.resolveTasks(ctx, dto.mentionedTaskIds);

      if (recordChange(changes, 'mentionedTaskIds', page.mentionedTaskIds, mentioned)) {
        page.mentionedTaskIds = mentioned;
      }
    }

    if (Object.keys(changes).length === 0) {
      return page;
    }

    await this.snapshot(page, previous);

    page.version += 1;
    page.updatedBy = ctx.userId;
    await page.save();

    this.events.emit(PAGE_UPDATED, {
      ...this.baseEvent(ctx, page),
      changes,
    } satisfies PageUpdatedEvent);

    return page;
  }

  async move(
    ctx: PermissionContext,
    pageId: Types.ObjectId,
    dto: MovePageDto,
  ): Promise<DocPageDocument> {
    const { page, doc } = await this.access.requirePage(ctx, pageId, 'edit');
    const parentPageId =
      dto.parentPageId === undefined
        ? page.parentPageId
        : dto.parentPageId === null
          ? null
          : await this.requireParent(doc, new Types.ObjectId(dto.parentPageId), page);

    const changes: TaskChanges = {};

    recordChange(changes, 'parentPageId', page.parentPageId, parentPageId);

    page.parentPageId = parentPageId;
    page.position = await positionBetweenSiblings(
      positionedModel(this.model),
      this.siblings(doc._id, parentPageId),
      dto.previousId ? new Types.ObjectId(dto.previousId) : null,
      dto.nextId ? new Types.ObjectId(dto.nextId) : null,
    );
    page.updatedBy = ctx.userId;

    await page.save();

    this.events.emit(PAGE_UPDATED, {
      ...this.baseEvent(ctx, page),
      changes,
    } satisfies PageUpdatedEvent);

    return page;
  }

  /** Deleting a page takes the pages nested in it and their snapshots. */
  async remove(ctx: PermissionContext, pageId: Types.ObjectId): Promise<void> {
    const { page, doc } = await this.access.requirePage(ctx, pageId, 'edit');
    const ids = await this.pageAndDescendantIds(doc, page._id);

    await this.versions.deleteMany({ pageId: { $in: ids } }).exec();
    await this.model.deleteMany({ _id: { $in: ids }, workspaceId: doc.workspaceId }).exec();
  }

  /** Snapshots of the page, newest first. */
  async listVersions(
    ctx: PermissionContext,
    pageId: Types.ObjectId,
    query: PaginationQueryDto,
  ): Promise<CursorPage<DocPageVersionDocument>> {
    const { page } = await this.access.requirePage(ctx, pageId, 'view');
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const base = { workspaceId: page.workspaceId, pageId: page._id };
    const docs = await this.versions
      .find(query.cursor ? { ...base, _id: { $lt: decodeObjectIdCursor(query.cursor) } } : base)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .exec();

    return buildCursorPage(docs, limit, (doc) => ({ id: String(doc._id) }));
  }

  /** Brings the content of a snapshot back, keeping the current one as a version. */
  async restoreVersion(
    ctx: PermissionContext,
    pageId: Types.ObjectId,
    versionId: Types.ObjectId,
  ): Promise<DocPageDocument> {
    const { page } = await this.access.requirePage(ctx, pageId, 'edit');
    const version = await this.versions
      .findOne({ _id: versionId, workspaceId: page.workspaceId, pageId: page._id })
      .exec();

    if (!version) {
      throw new BadRequestException({
        code: 'PAGE_VERSION_NOT_FOUND',
        message: 'Versão da página não encontrada.',
      });
    }

    await this.snapshot(page, stateOf(page), { force: true });

    const changes: TaskChanges = {};

    recordChange(changes, 'title', page.title, version.title);
    recordChange(changes, 'content', page.content, version.content);
    recordChange(changes, 'contentText', page.contentText, version.contentText);

    page.title = version.title;
    page.content = version.content;
    page.contentText = version.contentText;
    page.version += 1;
    page.updatedBy = ctx.userId;

    await page.save();

    this.events.emit(PAGE_UPDATED, {
      ...this.baseEvent(ctx, page),
      changes,
    } satisfies PageUpdatedEvent);

    return page;
  }

  /**
   * One snapshot per page every `PAGE_VERSION_INTERVAL_MS` at most, keeping the
   * newest `MAX_PAGE_VERSIONS`. The snapshot holds the content being replaced.
   */
  private async snapshot(
    page: DocPageDocument,
    state: PageState,
    options: { force?: boolean } = {},
  ): Promise<void> {
    const last = await this.versions.findOne({ pageId: page._id }).sort({ _id: -1 }).exec();

    if (!options.force && last && this.withinWindow(last)) {
      return;
    }

    await this.versions.create({
      workspaceId: page.workspaceId,
      docId: page.docId,
      pageId: page._id,
      version: state.version,
      title: state.title,
      content: state.content,
      contentText: state.contentText,
      createdBy: state.createdBy,
    });

    const extra = await this.versions
      .find({ pageId: page._id })
      .sort({ _id: -1 })
      .skip(MAX_PAGE_VERSIONS)
      .select('_id')
      .exec();

    if (extra.length > 0) {
      await this.versions.deleteMany({ _id: { $in: extra.map((doc) => doc._id) } }).exec();
    }
  }

  private withinWindow(version: DocPageVersionDocument): boolean {
    const createdAt = version.get('createdAt') as Date | undefined;

    return createdAt ? Date.now() - createdAt.getTime() < PAGE_VERSION_INTERVAL_MS : false;
  }

  /** The page plus every page nested under it, down to the depth limit. */
  private async pageAndDescendantIds(
    doc: DocDocument,
    pageId: Types.ObjectId,
  ): Promise<Types.ObjectId[]> {
    const ids = [pageId];
    let frontier = [pageId];

    for (let depth = 0; depth < MAX_PAGE_DEPTH && frontier.length > 0; depth += 1) {
      const children = await this.model
        .find({ docId: doc._id, parentPageId: { $in: frontier } })
        .select('_id')
        .exec();

      frontier = children.map((child) => child._id);
      ids.push(...frontier);
    }

    return ids;
  }

  /** The parent must belong to the same Doc and keep the nesting within the limit. */
  private async requireParent(
    doc: DocDocument,
    parentPageId: Types.ObjectId,
    moving?: DocPageDocument,
  ): Promise<Types.ObjectId> {
    const parent = await this.model
      .findOne({ _id: parentPageId, workspaceId: doc.workspaceId, docId: doc._id })
      .exec();

    if (!parent) {
      throw this.invalidParent();
    }

    const ancestors = await this.ancestorIds(doc, parent);

    if (moving && [String(parent._id), ...ancestors].includes(String(moving._id))) {
      throw this.invalidParent();
    }

    if (ancestors.length + 2 > MAX_PAGE_DEPTH) {
      throw new BadRequestException({
        code: 'PAGE_DEPTH_EXCEEDED',
        message: `Uma página pode ter no máximo ${MAX_PAGE_DEPTH} níveis.`,
      });
    }

    return parent._id;
  }

  private async ancestorIds(doc: DocDocument, page: DocPageDocument): Promise<string[]> {
    const ancestors: string[] = [];
    let current = page.parentPageId;

    for (let depth = 0; depth < MAX_PAGE_DEPTH && current; depth += 1) {
      ancestors.push(String(current));

      const parent = await this.model
        .findOne({ _id: current, docId: doc._id })
        .select('parentPageId')
        .exec();

      current = parent?.parentPageId ?? null;
    }

    return ancestors;
  }

  /** Tasks that really exist in the workspace; the rest is dropped in silence. */
  private async resolveTasks(
    ctx: PermissionContext,
    ids: string[] | undefined,
  ): Promise<Types.ObjectId[]> {
    if (!ids || ids.length === 0) {
      return [];
    }

    const docs = await this.tasks
      .find({
        workspaceId: ctx.workspaceId,
        _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
        deletedAt: null,
      })
      .select('_id')
      .exec();

    return docs.map((doc) => doc._id);
  }

  private invalidParent(): BadRequestException {
    return new BadRequestException({
      code: 'INVALID_PAGE_PARENT',
      message: 'A página pai não pertence a este Doc.',
    });
  }

  private siblings(
    docId: Types.ObjectId,
    parentPageId: Types.ObjectId | null,
  ): Record<string, unknown> {
    return { docId, parentPageId };
  }

  private baseEvent(ctx: PermissionContext, page: DocPageDocument) {
    return {
      workspaceId: page.workspaceId,
      docId: page.docId,
      pageId: page._id,
      parentPageId: page.parentPageId,
      version: page.version,
      actorId: ctx.userId,
    };
  }
}
