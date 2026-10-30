import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CursorPage, paginateByIdDesc } from '../../common/pagination/cursor';
import { DEFAULT_PAGE_SIZE } from '../../common/pagination/pagination-query.dto';
import { ReorderDto } from '../hierarchy/dto/reorder.dto';
import { HierarchyAccessService } from '../hierarchy/hierarchy-access.service';
import { HierarchyCreatedEvent } from '../hierarchy/hierarchy-events';
import {
  appendPosition,
  paginateByPosition,
  positionBetweenSiblings,
  positionedModel,
} from '../hierarchy/ordering';
import { PermissionLevel } from '../hierarchy/permission-levels';
import { PermissionContext } from '../hierarchy/permission.service';
import { CreateViewDto, UpdateViewDto, ViewConfigDto, ViewQueryDto } from './dto/view.dto';
import { View, ViewConfig, ViewDocument } from './schemas/view.schema';
import { DEFAULT_VIEWS, ViewLocationType } from './view-types';

/**
 * The config is stored as plain JSON: the DTO instance carries every optional
 * property as undefined, and the driver would write those as null.
 */
function toConfig(config: ViewConfigDto | undefined): ViewConfig {
  return config ? (JSON.parse(JSON.stringify(config)) as ViewConfig) : {};
}

@Injectable()
export class ViewsService {
  constructor(
    @InjectModel(View.name) private readonly model: Model<View>,
    private readonly access: HierarchyAccessService,
  ) {}

  viewNotFound(): NotFoundException {
    return new NotFoundException({ code: 'VIEW_NOT_FOUND', message: 'View não encontrada.' });
  }

  async create(ctx: PermissionContext, dto: CreateViewDto): Promise<ViewDocument> {
    const locationId = this.locationIdOf(dto.locationType, dto.locationId);

    await this.requireLocation(ctx, dto.locationType, locationId, 'edit');

    const view = await this.model.create({
      workspaceId: ctx.workspaceId,
      locationType: dto.locationType,
      locationId,
      type: dto.type,
      name: dto.name,
      config: toConfig(dto.config),
      private: dto.private ?? false,
      ownerId: ctx.userId,
      protected: dto.protected ?? false,
      isDefault: dto.isDefault ?? false,
      pinned: dto.pinned ?? false,
      position: await appendPosition(
        positionedModel(this.model),
        this.siblings(ctx, dto.locationType, locationId),
      ),
    });

    await this.keepSingleDefault(view);

    return view;
  }

  /** Views of a location in manual order; without it, the newest of the workspace. */
  async list(ctx: PermissionContext, query: ViewQueryDto): Promise<CursorPage<ViewDocument>> {
    if (query.locationType) {
      const locationId = this.locationIdOf(query.locationType, query.locationId, {
        optional: true,
      });

      await this.requireLocation(ctx, query.locationType, locationId, 'view');

      const docs = await this.model
        .find({
          workspaceId: ctx.workspaceId,
          locationType: query.locationType,
          ...(locationId ? { locationId } : {}),
        })
        .sort({ position: 1 })
        .exec();

      return paginateByPosition(this.visibleToOwner(ctx, docs), query);
    }

    const docs = await this.model.find({ workspaceId: ctx.workspaceId }).sort({ _id: -1 }).exec();
    const visible: ViewDocument[] = [];
    const cache = new Map<string, boolean>();

    for (const view of this.visibleToOwner(ctx, docs)) {
      if (await this.canSeeLocation(ctx, view, cache)) {
        visible.push(view);
      }
    }

    return paginateByIdDesc(visible, query.limit ?? DEFAULT_PAGE_SIZE, query.cursor);
  }

  get(ctx: PermissionContext, viewId: Types.ObjectId): Promise<ViewDocument> {
    return this.requireVisible(ctx, viewId);
  }

  async update(
    ctx: PermissionContext,
    viewId: Types.ObjectId,
    dto: UpdateViewDto,
  ): Promise<ViewDocument> {
    const view = await this.requireEditable(ctx, viewId);

    if (dto.name !== undefined) {
      view.name = dto.name;
    }

    if (dto.config !== undefined) {
      view.config = toConfig(dto.config);
    }

    if (dto.private !== undefined) {
      view.private = dto.private;
    }

    if (dto.protected !== undefined) {
      view.protected = dto.protected;
    }

    if (dto.isDefault !== undefined) {
      view.isDefault = dto.isDefault;
    }

    if (dto.pinned !== undefined) {
      view.pinned = dto.pinned;
    }

    await view.save();
    await this.keepSingleDefault(view);

    return view;
  }

  /** Copy in the same location, owned by whoever duplicated it. */
  async duplicate(ctx: PermissionContext, viewId: Types.ObjectId): Promise<ViewDocument> {
    const view = await this.requireVisible(ctx, viewId);

    await this.requireLocation(ctx, view.locationType, view.locationId, 'edit');

    return this.model.create({
      workspaceId: view.workspaceId,
      locationType: view.locationType,
      locationId: view.locationId,
      type: view.type,
      name: `${view.name} (cópia)`,
      config: view.config,
      private: view.private,
      ownerId: ctx.userId,
      protected: view.protected,
      isDefault: false,
      pinned: false,
      position: await appendPosition(
        positionedModel(this.model),
        this.siblings(ctx, view.locationType, view.locationId),
      ),
    });
  }

  async reorder(
    ctx: PermissionContext,
    viewId: Types.ObjectId,
    dto: ReorderDto,
  ): Promise<ViewDocument> {
    const view = await this.requireEditable(ctx, viewId);

    view.position = await positionBetweenSiblings(
      positionedModel(this.model),
      this.siblings(ctx, view.locationType, view.locationId),
      dto.previousId ? new Types.ObjectId(dto.previousId) : null,
      dto.nextId ? new Types.ObjectId(dto.nextId) : null,
    );

    return view.save();
  }

  async remove(ctx: PermissionContext, viewId: Types.ObjectId): Promise<void> {
    const view = await this.requireEditable(ctx, viewId);

    await this.model.deleteOne({ _id: view._id, workspaceId: ctx.workspaceId }).exec();
  }

  /** List and Board of a Space, Folder or List that was just created. */
  async createDefaults(event: HierarchyCreatedEvent): Promise<void> {
    for (const view of DEFAULT_VIEWS) {
      await this.model.create({
        workspaceId: event.workspaceId,
        locationType: event.resourceType,
        locationId: event.resourceId,
        type: view.type,
        name: view.name,
        config: {},
        private: false,
        ownerId: event.actorId,
        protected: false,
        isDefault: view.isDefault,
        pinned: false,
        position: await appendPosition(positionedModel(this.model), {
          workspaceId: event.workspaceId,
          locationType: event.resourceType,
          locationId: event.resourceId,
        }),
      });
    }
  }

  /** The view and the permission to read it; used by the export. */
  async requireVisible(ctx: PermissionContext, viewId: Types.ObjectId): Promise<ViewDocument> {
    const view = await this.load(ctx, viewId);

    await this.requireLocationOf(ctx, view, 'view');

    return view;
  }

  private async requireEditable(
    ctx: PermissionContext,
    viewId: Types.ObjectId,
  ): Promise<ViewDocument> {
    const view = await this.load(ctx, viewId);

    await this.requireLocationOf(ctx, view, 'edit');

    if (view.protected && String(view.ownerId) !== String(ctx.userId)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_VIEW',
        message: 'Esta view é protegida e só o dono pode alterá-la.',
      });
    }

    return view;
  }

  private async load(ctx: PermissionContext, viewId: Types.ObjectId): Promise<ViewDocument> {
    const view = await this.model.findOne({ _id: viewId, workspaceId: ctx.workspaceId }).exec();

    if (!view || (view.private && String(view.ownerId) !== String(ctx.userId))) {
      throw this.viewNotFound();
    }

    return view;
  }

  private visibleToOwner(ctx: PermissionContext, docs: ViewDocument[]): ViewDocument[] {
    return docs.filter((doc) => !doc.private || String(doc.ownerId) === String(ctx.userId));
  }

  private async canSeeLocation(
    ctx: PermissionContext,
    view: ViewDocument,
    cache: Map<string, boolean>,
  ): Promise<boolean> {
    const key = `${view.locationType}:${String(view.locationId)}`;
    const cached = cache.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const allowed = await this.requireLocation(ctx, view.locationType, view.locationId, 'view')
      .then(() => true)
      .catch(() => false);

    cache.set(key, allowed);

    return allowed;
  }

  private async requireLocationOf(
    ctx: PermissionContext,
    view: ViewDocument,
    required: PermissionLevel,
  ): Promise<void> {
    try {
      await this.requireLocation(ctx, view.locationType, view.locationId, required);
    } catch (error) {
      throw error instanceof NotFoundException ? this.viewNotFound() : error;
    }
  }

  /** `everything` is open to every member; the rest follows the hierarchy. */
  private async requireLocation(
    ctx: PermissionContext,
    locationType: ViewLocationType,
    locationId: Types.ObjectId | null,
    required: PermissionLevel,
  ): Promise<void> {
    if (locationType === 'everything' || !locationId) {
      return;
    }

    if (locationType === 'space') {
      await this.access.requireSpace(ctx, locationId, required);

      return;
    }

    if (locationType === 'folder') {
      await this.access.requireFolder(ctx, locationId, required);

      return;
    }

    await this.access.requireList(ctx, locationId, required);
  }

  private locationIdOf(
    locationType: ViewLocationType,
    locationId: string | undefined,
    options: { optional?: boolean } = {},
  ): Types.ObjectId | null {
    if (locationType === 'everything') {
      return null;
    }

    if (!locationId) {
      if (options.optional) {
        return null;
      }

      throw new BadRequestException({
        code: 'INVALID_VIEW_LOCATION',
        message: 'Informe o id do Space, Folder ou List da view.',
      });
    }

    return new Types.ObjectId(locationId);
  }

  /** Only one default view per location. */
  private async keepSingleDefault(view: ViewDocument): Promise<void> {
    if (!view.isDefault) {
      return;
    }

    await this.model
      .updateMany(
        {
          workspaceId: view.workspaceId,
          locationType: view.locationType,
          locationId: view.locationId,
          _id: { $ne: view._id },
          isDefault: true,
        },
        { $set: { isDefault: false } },
      )
      .exec();
  }

  private siblings(
    ctx: PermissionContext,
    locationType: ViewLocationType,
    locationId: Types.ObjectId | null,
  ): Record<string, unknown> {
    return { workspaceId: ctx.workspaceId, locationType, locationId };
  }
}
