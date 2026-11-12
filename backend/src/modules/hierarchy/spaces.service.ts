import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CursorPage } from '../../common/pagination/cursor';
import { CreateSpaceDto, SpaceQueryDto, UpdateSpaceDto } from './dto/space.dto';
import { ReorderDto } from './dto/reorder.dto';
import { SPACE_CREATED, HierarchyCreatedEvent } from './hierarchy-events';
import { HierarchyAccessService } from './hierarchy-access.service';
import {
  appendPosition,
  paginateByPosition,
  positionBetweenSiblings,
  positionedModel,
} from './ordering';
import { PermissionContext, PermissionService } from './permission.service';
import { Folder } from './schemas/folder.schema';
import { List } from './schemas/list.schema';
import { ClickAppsOverride, Space, SpaceDocument } from './schemas/space.schema';
import { StatusSetsService } from './status-sets.service';
import { DEFAULT_STATUS_TEMPLATE } from './status-templates';

@Injectable()
export class SpacesService {
  constructor(
    @InjectModel(Space.name) private readonly model: Model<Space>,
    @InjectModel(Folder.name) private readonly folders: Model<Folder>,
    @InjectModel(List.name) private readonly lists: Model<List>,
    private readonly access: HierarchyAccessService,
    private readonly statusSets: StatusSetsService,
    private readonly permissions: PermissionService,
    private readonly events: EventEmitter2,
  ) {}

  /** Creates the Space and, when none is given, its status set from a template. */
  async create(ctx: PermissionContext, dto: CreateSpaceDto): Promise<SpaceDocument> {
    const statusSetId = dto.statusSetId
      ? await this.statusSets.requireOwned(ctx.workspaceId, dto.statusSetId)
      : (
          await this.statusSets.createFromTemplate(
            ctx.workspaceId,
            dto.statusTemplate ?? DEFAULT_STATUS_TEMPLATE,
            dto.name,
          )
        )._id;

    const space = await this.model.create({
      workspaceId: ctx.workspaceId,
      name: dto.name,
      color: dto.color,
      icon: dto.icon,
      private: dto.private ?? false,
      statusSetId,
      clickApps: toClickApps(dto.clickApps),
      position: await appendPosition(positionedModel(this.model), this.siblings(ctx)),
    });

    if (space.private) {
      await this.permissions.share(ctx.workspaceId, {
        resourceType: 'space',
        resourceId: space._id,
        principalType: 'user',
        principalId: ctx.userId,
        level: 'full',
        createdBy: ctx.userId,
      });
    }

    await this.events.emitAsync(SPACE_CREATED, {
      workspaceId: ctx.workspaceId,
      resourceType: 'space',
      resourceId: space._id,
      actorId: ctx.userId,
    } satisfies HierarchyCreatedEvent);

    return space;
  }

  async list(ctx: PermissionContext, query: SpaceQueryDto): Promise<CursorPage<SpaceDocument>> {
    const spaces = await this.access.visibleSpaces(ctx, {
      includeArchived: query.includeArchived ?? false,
    });

    return paginateByPosition(spaces, query);
  }

  get(ctx: PermissionContext, spaceId: Types.ObjectId): Promise<SpaceDocument> {
    return this.access.requireSpace(ctx, spaceId, 'view');
  }

  async update(
    ctx: PermissionContext,
    spaceId: Types.ObjectId,
    dto: UpdateSpaceDto,
  ): Promise<SpaceDocument> {
    const required = dto.private !== undefined || dto.statusSetId !== undefined ? 'full' : 'edit';
    const space = await this.access.requireSpace(ctx, spaceId, required);

    if (dto.name !== undefined) {
      space.name = dto.name;
    }

    if (dto.color !== undefined) {
      space.color = dto.color;
    }

    if (dto.icon !== undefined) {
      space.icon = dto.icon;
    }

    if (dto.private !== undefined) {
      space.private = dto.private;
    }

    if (dto.statusSetId !== undefined) {
      space.statusSetId = await this.statusSets.requireOwned(ctx.workspaceId, dto.statusSetId);
    }

    if (dto.clickApps !== undefined) {
      space.clickApps = toClickApps(dto.clickApps);
    }

    return space.save();
  }

  async archive(ctx: PermissionContext, spaceId: Types.ObjectId): Promise<SpaceDocument> {
    const space = await this.access.requireSpace(ctx, spaceId, 'edit');

    if (space.archivedAt) {
      return space;
    }

    const at = new Date();

    space.archivedAt = at;
    await space.save();
    await this.cascadeArchive(space, null, at);

    return space;
  }

  async unarchive(ctx: PermissionContext, spaceId: Types.ObjectId): Promise<SpaceDocument> {
    const space = await this.access.requireSpace(ctx, spaceId, 'edit');
    const at = space.archivedAt;

    if (!at) {
      return space;
    }

    space.archivedAt = null;
    await space.save();
    await this.cascadeArchive(space, at, null);

    return space;
  }

  /** Soft delete: the Space and everything inside it go to the trash together. */
  async remove(ctx: PermissionContext, spaceId: Types.ObjectId): Promise<void> {
    const space = await this.access.requireSpace(ctx, spaceId, 'full');
    const at = new Date();

    space.deletedAt = at;
    await space.save();
    await this.cascadeDelete(space, null, at);
  }

  async restore(ctx: PermissionContext, spaceId: Types.ObjectId): Promise<SpaceDocument> {
    const space = await this.access.requireSpace(ctx, spaceId, 'full', { includeDeleted: true });
    const at = space.deletedAt;

    if (!at) {
      return space;
    }

    space.deletedAt = null;
    await space.save();
    await this.cascadeDelete(space, at, null);

    return space;
  }

  async reorder(
    ctx: PermissionContext,
    spaceId: Types.ObjectId,
    dto: ReorderDto,
  ): Promise<SpaceDocument> {
    const space = await this.access.requireSpace(ctx, spaceId, 'edit');

    space.position = await positionBetweenSiblings(
      positionedModel(this.model),
      this.siblings(ctx),
      dto.previousId ? new Types.ObjectId(dto.previousId) : null,
      dto.nextId ? new Types.ObjectId(dto.nextId) : null,
    );

    return space.save();
  }

  private siblings(ctx: PermissionContext): Record<string, unknown> {
    return { workspaceId: ctx.workspaceId, deletedAt: null };
  }

  /** Stamps or clears `deletedAt` on the folders and lists of the Space. */
  private async cascadeDelete(
    space: SpaceDocument,
    from: Date | null,
    to: Date | null,
  ): Promise<void> {
    const filter = { workspaceId: space.workspaceId, spaceId: space._id, deletedAt: from };

    await Promise.all([
      this.folders.updateMany(filter, { $set: { deletedAt: to } }).exec(),
      this.lists.updateMany(filter, { $set: { deletedAt: to } }).exec(),
    ]);
  }

  private async cascadeArchive(
    space: SpaceDocument,
    from: Date | null,
    to: Date | null,
  ): Promise<void> {
    const filter = { workspaceId: space.workspaceId, spaceId: space._id, archivedAt: from };

    await Promise.all([
      this.folders.updateMany(filter, { $set: { archivedAt: to } }).exec(),
      this.lists.updateMany(filter, { $set: { archivedAt: to } }).exec(),
    ]);
  }
}

/** Keeps only the ClickApps the caller actually sent. */
function toClickApps(override: ClickAppsOverride | undefined): ClickAppsOverride | undefined {
  if (!override) {
    return undefined;
  }

  const entries = Object.entries(override).filter(([, value]) => value !== undefined);

  return entries.length > 0 ? (Object.fromEntries(entries) as ClickAppsOverride) : undefined;
}
