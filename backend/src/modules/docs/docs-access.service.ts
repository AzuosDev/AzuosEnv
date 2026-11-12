import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { HierarchyAccessService } from '../hierarchy/hierarchy-access.service';
import { PermissionLevel, hasLevelAtLeast } from '../hierarchy/permission-levels';
import { PermissionContext, PermissionService } from '../hierarchy/permission.service';
import { hasRoleAtLeast } from '../workspaces/workspace-roles';
import { DocLocationType, MAX_DOC_SCAN } from './docs-fields';
import { Doc, DocDocument } from './schemas/doc.schema';
import { DocPage, DocPageDocument } from './schemas/doc-page.schema';

export interface LoadDocOptions {
  /** Needed by restore, which has to find the soft-deleted Doc. */
  includeDeleted?: boolean;
  /** Needed by the public share, which reads the stored token hash. */
  withShareToken?: boolean;
}

export interface PageWithDoc {
  page: DocPageDocument;
  doc: DocDocument;
}

/**
 * Loads Docs and pages, resolves the permission of the location they live in and
 * hides what the requester cannot see. A private Doc belongs to its author only.
 */
@Injectable()
export class DocsAccessService {
  constructor(
    @InjectModel(Doc.name) private readonly docs: Model<Doc>,
    @InjectModel(DocPage.name) private readonly pages: Model<DocPage>,
    private readonly hierarchy: HierarchyAccessService,
    private readonly permissions: PermissionService,
  ) {}

  docNotFound(): NotFoundException {
    return new NotFoundException({ code: 'DOC_NOT_FOUND', message: 'Doc não encontrado.' });
  }

  pageNotFound(): NotFoundException {
    return new NotFoundException({ code: 'PAGE_NOT_FOUND', message: 'Página não encontrada.' });
  }

  /** Level of the requester over the location; `workspace` is open to members. */
  async locationLevel(
    ctx: PermissionContext,
    locationType: DocLocationType,
    locationId: Types.ObjectId | null,
  ): Promise<PermissionLevel | null> {
    if (locationType === 'workspace' || !locationId) {
      return hasRoleAtLeast(ctx.role, 'member') ? 'full' : null;
    }

    return this.chainLevel(ctx, locationType, locationId);
  }

  /** Enforces `required` over the location of a Doc that is about to be created. */
  async requireLocation(
    ctx: PermissionContext,
    locationType: DocLocationType,
    locationId: Types.ObjectId | null,
    required: PermissionLevel,
  ): Promise<void> {
    const level = await this.locationLevel(ctx, locationType, locationId);

    this.permissions.assertLevel(level, required, () => this.docNotFound());
  }

  /** The Doc plus the permission to use it at `required`. */
  async requireDoc(
    ctx: PermissionContext,
    docId: Types.ObjectId,
    required: PermissionLevel,
    options: LoadDocOptions = {},
  ): Promise<DocDocument> {
    const query = this.docs.findOne(
      options.includeDeleted
        ? { _id: docId, workspaceId: ctx.workspaceId }
        : { _id: docId, workspaceId: ctx.workspaceId, deletedAt: null },
    );

    if (options.withShareToken) {
      query.select('+share.tokenHash');
    }

    const doc = await query.exec();

    if (!doc || !this.visibleToAuthor(ctx, doc)) {
      throw this.docNotFound();
    }

    await this.requireLocation(ctx, doc.locationType, doc.locationId, required);

    return doc;
  }

  /** The page plus its Doc, with the level enforced over the Doc. */
  async requirePage(
    ctx: PermissionContext,
    pageId: Types.ObjectId,
    required: PermissionLevel,
  ): Promise<PageWithDoc> {
    const page = await this.pages.findOne({ _id: pageId, workspaceId: ctx.workspaceId }).exec();

    if (!page) {
      throw this.pageNotFound();
    }

    try {
      return { page, doc: await this.requireDoc(ctx, page.docId, required) };
    } catch (error) {
      throw error instanceof NotFoundException ? this.pageNotFound() : error;
    }
  }

  /** Docs matching the filter that the requester can at least see, newest first. */
  async visibleDocs(
    ctx: PermissionContext,
    filter: Record<string, unknown> = {},
  ): Promise<DocDocument[]> {
    const docs = await this.docs
      .find({ workspaceId: ctx.workspaceId, deletedAt: null, ...filter })
      .sort({ _id: -1 })
      .limit(MAX_DOC_SCAN)
      .exec();

    return this.filterVisible(ctx, docs);
  }

  /** Same filter as `visibleDocs`, keeping the order the caller already has. */
  async filterVisible(ctx: PermissionContext, docs: DocDocument[]): Promise<DocDocument[]> {
    const cache = new Map<string, boolean>();
    const visible: DocDocument[] = [];

    for (const doc of docs) {
      if (!this.visibleToAuthor(ctx, doc)) {
        continue;
      }

      const key = `${doc.locationType}:${String(doc.locationId)}`;
      let allowed = cache.get(key);

      if (allowed === undefined) {
        allowed = hasLevelAtLeast(
          await this.locationLevel(ctx, doc.locationType, doc.locationId),
          'view',
        );
        cache.set(key, allowed);
      }

      if (allowed) {
        visible.push(doc);
      }
    }

    return visible;
  }

  /** Ids of the visible Docs, used by the global search over pages. */
  async visibleDocIds(ctx: PermissionContext): Promise<Types.ObjectId[]> {
    const docs = await this.visibleDocs(ctx, { archivedAt: null });

    return docs.map((doc) => doc._id);
  }

  private visibleToAuthor(ctx: PermissionContext, doc: DocDocument): boolean {
    return !doc.private || String(doc.createdBy) === String(ctx.userId);
  }

  private async chainLevel(
    ctx: PermissionContext,
    locationType: DocLocationType,
    locationId: Types.ObjectId,
  ): Promise<PermissionLevel | null> {
    try {
      if (locationType === 'space') {
        const space = await this.hierarchy.requireSpace(ctx, locationId, 'view');

        return this.permissions.levelFor(ctx, this.hierarchy.spaceChain(space));
      }

      if (locationType === 'folder') {
        const folder = await this.hierarchy.requireFolder(ctx, locationId, 'view');

        return this.permissions.levelFor(ctx, await this.hierarchy.folderChain(folder));
      }

      const list = await this.hierarchy.requireList(ctx, locationId, 'view');

      return this.permissions.levelFor(ctx, await this.hierarchy.listChain(list));
    } catch {
      return null;
    }
  }
}
