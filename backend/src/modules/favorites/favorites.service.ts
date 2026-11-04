import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CursorPage } from '../../common/pagination/cursor';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
import { DocsAccessService } from '../docs/docs-access.service';
import { HierarchyAccessService } from '../hierarchy/hierarchy-access.service';
import {
  appendPosition,
  paginateByPosition,
  positionBetweenSiblings,
  positionedModel,
} from '../hierarchy/ordering';
import { PermissionContext } from '../hierarchy/permission.service';
import { ReorderDto } from '../hierarchy/dto/reorder.dto';
import { TaskAccessService } from '../tasks/task-access.service';
import { CreateFavoriteDto } from './dto/favorite.dto';
import { FavoriteEntityType } from './favorite-fields';
import { RecentsService } from './recents.service';
import { Favorite, FavoriteDocument } from './schemas/favorite.schema';

/** The favourite plus a summary of the entity it points to. */
export type FavoriteItem = Record<string, unknown>;

/** One recently opened task or List, newest first. */
export interface RecentItemView {
  entityType: FavoriteEntityType;
  entityId: string;
  openedAt: string;
  entity: EntitySummary;
}

/** Name and ids the sidebar needs to render the entry. */
export interface EntitySummary {
  id: string;
  name: string;
  customId?: string;
  spaceId?: string;
  folderId?: string | null;
  listId?: string;
}

@Injectable()
export class FavoritesService {
  constructor(
    @InjectModel(Favorite.name) private readonly model: Model<Favorite>,
    private readonly access: HierarchyAccessService,
    private readonly taskAccess: TaskAccessService,
    private readonly docs: DocsAccessService,
    private readonly recents: RecentsService,
  ) {}

  favoriteNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'FAVORITE_NOT_FOUND',
      message: 'Favorito não encontrado.',
    });
  }

  /** Favouriting the same entity twice keeps the first entry. */
  async create(ctx: PermissionContext, dto: CreateFavoriteDto): Promise<FavoriteItem> {
    const entityId = new Types.ObjectId(dto.entityId);
    const entity = await this.summaryOf(ctx, dto.entityType, entityId);
    const existing = await this.model
      .findOne({
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
        entityType: dto.entityType,
        entityId,
      })
      .exec();

    if (existing) {
      return this.withEntity(existing, entity);
    }

    const favorite = await this.model.create({
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      entityType: dto.entityType,
      entityId,
      position: await appendPosition(positionedModel(this.model), this.siblings(ctx)),
    });

    return this.withEntity(favorite, entity);
  }

  /** Manual order; entries the user can no longer see are left out. */
  async list(ctx: PermissionContext, query: PaginationQueryDto): Promise<CursorPage<FavoriteItem>> {
    const docs = await this.model.find(this.siblings(ctx)).sort({ position: 1 }).exec();
    const visible: FavoriteDocument[] = [];
    const summaries = new Map<string, EntitySummary>();

    for (const doc of docs) {
      const entity = await this.summaryOrNull(ctx, doc.entityType, doc.entityId);

      if (entity) {
        summaries.set(String(doc._id), entity);
        visible.push(doc);
      }
    }

    const page = paginateByPosition(visible, query);

    return {
      items: page.items.map((doc) => this.withEntity(doc, summaries.get(String(doc._id)))),
      nextCursor: page.nextCursor,
    };
  }

  /** Last tasks and Lists the user opened, without what they can no longer see. */
  async recent(ctx: PermissionContext): Promise<{ items: RecentItemView[] }> {
    const docs = await this.recents.recent(ctx);
    const items: RecentItemView[] = [];

    for (const doc of docs) {
      const entity = await this.summaryOrNull(ctx, doc.entityType, doc.entityId);

      if (entity) {
        items.push({
          entityType: doc.entityType,
          entityId: String(doc.entityId),
          openedAt: doc.openedAt.toISOString(),
          entity,
        });
      }
    }

    return { items };
  }

  async remove(ctx: PermissionContext, favoriteId: Types.ObjectId): Promise<void> {
    const result = await this.model
      .deleteOne({ _id: favoriteId, userId: ctx.userId, workspaceId: ctx.workspaceId })
      .exec();

    if (result.deletedCount === 0) {
      throw this.favoriteNotFound();
    }
  }

  async reorder(
    ctx: PermissionContext,
    favoriteId: Types.ObjectId,
    dto: ReorderDto,
  ): Promise<FavoriteItem> {
    const favorite = await this.require(ctx, favoriteId);

    favorite.position = await positionBetweenSiblings(
      positionedModel(this.model),
      this.siblings(ctx),
      dto.previousId ? new Types.ObjectId(dto.previousId) : null,
      dto.nextId ? new Types.ObjectId(dto.nextId) : null,
    );

    await favorite.save();

    return this.withEntity(
      favorite,
      await this.summaryOrNull(ctx, favorite.entityType, favorite.entityId),
    );
  }

  /** Drops the entries of entities that were purged for good. */
  async removeForEntities(
    workspaceId: Types.ObjectId,
    entityType: FavoriteEntityType,
    entityIds: Types.ObjectId[],
  ): Promise<void> {
    if (entityIds.length === 0) {
      return;
    }

    await this.model.deleteMany({ workspaceId, entityType, entityId: { $in: entityIds } }).exec();
  }

  private async require(
    ctx: PermissionContext,
    favoriteId: Types.ObjectId,
  ): Promise<FavoriteDocument> {
    const favorite = await this.model
      .findOne({ _id: favoriteId, userId: ctx.userId, workspaceId: ctx.workspaceId })
      .exec();

    if (!favorite) {
      throw this.favoriteNotFound();
    }

    return favorite;
  }

  /** Enforces that the user can still see the entity behind the favourite. */
  private async summaryOf(
    ctx: PermissionContext,
    entityType: FavoriteEntityType,
    entityId: Types.ObjectId,
  ): Promise<EntitySummary> {
    if (entityType === 'space') {
      const space = await this.access.requireSpace(ctx, entityId, 'view');

      return { id: String(space._id), name: space.name };
    }

    if (entityType === 'folder') {
      const folder = await this.access.requireFolder(ctx, entityId, 'view');

      return { id: String(folder._id), name: folder.name, spaceId: String(folder.spaceId) };
    }

    if (entityType === 'list') {
      const list = await this.access.requireList(ctx, entityId, 'view');

      return {
        id: String(list._id),
        name: list.name,
        spaceId: String(list.spaceId),
        folderId: list.folderId ? String(list.folderId) : null,
      };
    }

    if (entityType === 'doc') {
      const doc = await this.docs.requireDoc(ctx, entityId, 'view');

      return { id: String(doc._id), name: doc.title };
    }

    const { task } = await this.taskAccess.requireTask(ctx, String(entityId), 'view');

    return {
      id: String(task._id),
      name: task.name,
      customId: task.customId,
      listId: String(task.listId),
    };
  }

  private async summaryOrNull(
    ctx: PermissionContext,
    entityType: FavoriteEntityType,
    entityId: Types.ObjectId,
  ): Promise<EntitySummary | null> {
    try {
      return await this.summaryOf(ctx, entityType, entityId);
    } catch {
      return null;
    }
  }

  private withEntity(
    favorite: FavoriteDocument,
    entity: EntitySummary | null | undefined,
  ): FavoriteItem {
    return { ...favorite.toJSON(), entity: entity ?? null };
  }

  private siblings(ctx: PermissionContext): Record<string, unknown> {
    return { userId: ctx.userId, workspaceId: ctx.workspaceId };
  }
}
