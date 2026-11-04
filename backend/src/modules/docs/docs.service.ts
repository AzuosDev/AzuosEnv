import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomBytes } from 'node:crypto';
import { CursorPage, paginateByIdDesc } from '../../common/pagination/cursor';
import { DEFAULT_PAGE_SIZE } from '../../common/pagination/pagination-query.dto';
import { sha256Hex } from '../../common/utils/hash';
import { appendPosition, positionedModel } from '../hierarchy/ordering';
import { PermissionLevel } from '../hierarchy/permission-levels';
import { PermissionContext } from '../hierarchy/permission.service';
import { RecentsService } from '../favorites/recents.service';
import { Favorite } from '../favorites/schemas/favorite.schema';
import { RecentItem } from '../favorites/schemas/recent-item.schema';
import { View } from '../views/schemas/view.schema';
import { DocsAccessService } from './docs-access.service';
import { MAX_DOC_PAGES, SHARE_TOKEN_BYTES } from './docs-fields';
import { CreateDocDto, DocQueryDto, ShareDocDto, UpdateDocDto } from './dto/doc.dto';
import { Doc, DocDocument } from './schemas/doc.schema';
import { DocPage, DocPageDocument } from './schemas/doc-page.schema';

/** Answer of the public link: the Doc and its pages, read-only. */
export interface PublicDocView {
  doc: Record<string, unknown>;
  pages: Record<string, unknown>[];
}

export interface ShareResult {
  doc: DocDocument;
  /** Shown only when the link is created; afterwards only the hash is kept. */
  token: string | null;
  url: string | null;
}

@Injectable()
export class DocsService {
  constructor(
    @InjectModel(Doc.name) private readonly model: Model<Doc>,
    @InjectModel(DocPage.name) private readonly pages: Model<DocPage>,
    @InjectModel(View.name) private readonly views: Model<View>,
    @InjectModel(Favorite.name) private readonly favorites: Model<Favorite>,
    @InjectModel(RecentItem.name) private readonly recentItems: Model<RecentItem>,
    private readonly access: DocsAccessService,
    private readonly recents: RecentsService,
    private readonly config: ConfigService,
  ) {}

  async create(ctx: PermissionContext, dto: CreateDocDto): Promise<DocDocument> {
    const locationId = this.locationIdOf(dto.locationType, dto.locationId);

    await this.access.requireLocation(ctx, dto.locationType, locationId, 'edit');

    const doc = await this.model.create({
      workspaceId: ctx.workspaceId,
      locationType: dto.locationType,
      locationId,
      title: dto.title,
      icon: dto.icon ?? null,
      private: dto.private ?? false,
      isWiki: dto.isWiki ?? false,
      share: { public: false, tokenHash: null },
      createdBy: ctx.userId,
    });

    await this.createDocView(ctx, doc);

    return doc;
  }

  /** Hub of the workspace: recent, favorites, mine or all the visible Docs. */
  async list(ctx: PermissionContext, query: DocQueryDto): Promise<CursorPage<DocDocument>> {
    const tab = query.tab ?? 'all';
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const filter: Record<string, unknown> = { archivedAt: null };

    if (query.locationType) {
      filter.locationType = query.locationType;
    }

    if (query.locationId) {
      filter.locationId = new Types.ObjectId(query.locationId);
    }

    if (tab === 'recent' || tab === 'favorites') {
      return { items: await this.pinnedTab(ctx, tab, filter), nextCursor: null };
    }

    if (tab === 'mine') {
      filter.createdBy = ctx.userId;
    }

    return paginateByIdDesc(await this.access.visibleDocs(ctx, filter), limit, query.cursor);
  }

  /** The Doc itself; reading it feeds the recents of the user. */
  async get(ctx: PermissionContext, docId: Types.ObjectId): Promise<DocDocument> {
    const doc = await this.access.requireDoc(ctx, docId, 'view');

    await this.recents.record(ctx, 'doc', doc._id);

    return doc;
  }

  /** Pages of the Doc in manual order; the client builds the tree by parentPageId. */
  async tree(ctx: PermissionContext, docId: Types.ObjectId): Promise<{ items: DocPageDocument[] }> {
    const doc = await this.access.requireDoc(ctx, docId, 'view');

    return { items: await this.pagesOf(doc._id) };
  }

  async update(
    ctx: PermissionContext,
    docId: Types.ObjectId,
    dto: UpdateDocDto,
  ): Promise<DocDocument> {
    const required: PermissionLevel = dto.private === undefined ? 'edit' : 'full';
    const doc = await this.access.requireDoc(ctx, docId, required);

    if (dto.title !== undefined) {
      doc.title = dto.title;
    }

    if (dto.icon !== undefined) {
      doc.icon = dto.icon ?? null;
    }

    if (dto.private !== undefined) {
      doc.private = dto.private;
    }

    if (dto.isWiki !== undefined) {
      doc.isWiki = dto.isWiki;
    }

    await doc.save();

    if (dto.title !== undefined) {
      await this.views.updateMany(this.docViewFilter(doc), { $set: { name: doc.title } }).exec();
    }

    return doc;
  }

  /** Soft delete; the view of the Doc goes with it and comes back on restore. */
  async remove(ctx: PermissionContext, docId: Types.ObjectId): Promise<void> {
    const doc = await this.access.requireDoc(ctx, docId, 'full');

    doc.deletedAt = new Date();
    await doc.save();
    await this.views.deleteMany(this.docViewFilter(doc)).exec();
  }

  async restore(ctx: PermissionContext, docId: Types.ObjectId): Promise<DocDocument> {
    const doc = await this.access.requireDoc(ctx, docId, 'full', { includeDeleted: true });

    if (doc.deletedAt) {
      doc.deletedAt = null;
      await doc.save();
      await this.createDocView(ctx, doc);
    }

    return doc;
  }

  async setArchived(
    ctx: PermissionContext,
    docId: Types.ObjectId,
    archived: boolean,
  ): Promise<DocDocument> {
    const doc = await this.access.requireDoc(ctx, docId, 'edit');

    doc.archivedAt = archived ? (doc.archivedAt ?? new Date()) : null;

    return doc.save();
  }

  /** Creates or revokes the public read-only link of the Doc. */
  async share(
    ctx: PermissionContext,
    docId: Types.ObjectId,
    dto: ShareDocDto,
  ): Promise<ShareResult> {
    const doc = await this.access.requireDoc(ctx, docId, 'full', { withShareToken: true });

    if (!dto.public) {
      doc.share = { public: false, tokenHash: null };
      await doc.save();

      return { doc, token: null, url: null };
    }

    const token = randomBytes(SHARE_TOKEN_BYTES).toString('base64url');

    doc.share = { public: true, tokenHash: sha256Hex(token) };
    await doc.save();

    return { doc, token, url: this.shareUrl(token) };
  }

  /** Read-only answer of the public link; a wrong token looks like a missing Doc. */
  async publicDoc(token: string): Promise<PublicDocView> {
    const doc = await this.model
      .findOne({ 'share.public': true, 'share.tokenHash': sha256Hex(token), deletedAt: null })
      .select('+share.tokenHash')
      .exec();

    if (!doc) {
      throw new NotFoundException({ code: 'DOC_NOT_FOUND', message: 'Doc não encontrado.' });
    }

    const pages = await this.pagesOf(doc._id);

    return {
      doc: {
        id: String(doc._id),
        title: doc.title,
        icon: doc.icon,
        isWiki: doc.isWiki,
        updatedAt: doc.get('updatedAt'),
      },
      pages: pages.map((page) => ({
        id: String(page._id),
        parentPageId: page.parentPageId ? String(page.parentPageId) : null,
        title: page.title,
        content: page.content,
        contentText: page.contentText,
        position: page.position,
        version: page.version,
      })),
    };
  }

  private pagesOf(docId: Types.ObjectId): Promise<DocPageDocument[]> {
    return this.pages.find({ docId }).sort({ position: 1 }).limit(MAX_DOC_PAGES).exec();
  }

  /** Docs of the favorites or of the recents of the requester, in their own order. */
  private async pinnedTab(
    ctx: PermissionContext,
    tab: 'recent' | 'favorites',
    filter: Record<string, unknown>,
  ): Promise<DocDocument[]> {
    const scope = { userId: ctx.userId, workspaceId: ctx.workspaceId };
    const rows: Pick<Favorite, 'entityId'>[] =
      tab === 'favorites'
        ? await this.favorites
            .find({ ...scope, entityType: 'doc' })
            .sort({ position: 1 })
            .exec()
        : await this.recentItems
            .find({ ...scope, entityType: 'doc' })
            .sort({ openedAt: -1, _id: -1 })
            .exec();

    if (rows.length === 0) {
      return [];
    }

    const docs = await this.model
      .find({
        workspaceId: ctx.workspaceId,
        deletedAt: null,
        _id: { $in: rows.map((row) => row.entityId) },
        ...filter,
      })
      .exec();
    const byId = new Map(docs.map((doc) => [String(doc._id), doc]));
    const ordered = rows
      .map((row) => byId.get(String(row.entityId)))
      .filter((doc): doc is DocDocument => doc !== undefined);

    return this.access.filterVisible(ctx, ordered);
  }

  /** Every Doc of a location is also a view of type `doc` there. */
  private async createDocView(ctx: PermissionContext, doc: DocDocument): Promise<void> {
    if (doc.locationType === 'workspace' || !doc.locationId) {
      return;
    }

    const siblings = {
      workspaceId: doc.workspaceId,
      locationType: doc.locationType,
      locationId: doc.locationId,
    };

    await this.views.create({
      ...siblings,
      type: 'doc',
      name: doc.title,
      config: { options: { docId: String(doc._id) } },
      private: doc.private,
      ownerId: ctx.userId,
      protected: false,
      isDefault: false,
      pinned: false,
      position: await appendPosition(positionedModel(this.views), siblings),
    });
  }

  private docViewFilter(doc: DocDocument): Record<string, unknown> {
    return {
      workspaceId: doc.workspaceId,
      type: 'doc',
      'config.options.docId': String(doc._id),
    };
  }

  private shareUrl(token: string): string {
    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:5173';

    return `${appUrl.replace(/\/+$/, '')}/public/docs/${token}`;
  }

  private locationIdOf(
    locationType: CreateDocDto['locationType'],
    locationId: string | undefined,
  ): Types.ObjectId | null {
    if (locationType === 'workspace') {
      return null;
    }

    if (!locationId) {
      throw new BadRequestException({
        code: 'INVALID_DOC_LOCATION',
        message: 'Informe o locationId do local do Doc.',
      });
    }

    return new Types.ObjectId(locationId);
  }
}
