import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { HierarchyAccessService } from '../hierarchy/hierarchy-access.service';
import { PermissionLevel, hasLevelAtLeast } from '../hierarchy/permission-levels';
import { PermissionContext, PermissionService } from '../hierarchy/permission.service';
import { hasRoleAtLeast } from '../workspaces/workspace-roles';
import { MAX_WHITEBOARD_SCAN, WhiteboardLocationType } from './whiteboard-fields';
import { Whiteboard, WhiteboardDocument } from './schemas/whiteboard.schema';

/**
 * Loads whiteboards and resolves the permission of the location they live in. Same
 * rule as the Docs: ver = view, criar/editar = edit, excluir = full.
 */
@Injectable()
export class WhiteboardsAccessService {
  constructor(
    @InjectModel(Whiteboard.name) private readonly model: Model<Whiteboard>,
    private readonly hierarchy: HierarchyAccessService,
    private readonly permissions: PermissionService,
  ) {}

  notFound(): NotFoundException {
    return new NotFoundException({
      code: 'WHITEBOARD_NOT_FOUND',
      message: 'Quadro não encontrado.',
    });
  }

  /** Level of the requester over the location; `workspace` is open to members. */
  async locationLevel(
    ctx: PermissionContext,
    locationType: WhiteboardLocationType,
    locationId: Types.ObjectId | null,
  ): Promise<PermissionLevel | null> {
    if (locationType === 'workspace' || !locationId) {
      return hasRoleAtLeast(ctx.role, 'member') ? 'full' : null;
    }

    return this.chainLevel(ctx, locationType, locationId);
  }

  async requireLocation(
    ctx: PermissionContext,
    locationType: WhiteboardLocationType,
    locationId: Types.ObjectId | null,
    required: PermissionLevel,
  ): Promise<void> {
    const level = await this.locationLevel(ctx, locationType, locationId);

    this.permissions.assertLevel(level, required, () => this.notFound());
  }

  /** The whiteboard plus the permission to use it at `required`. */
  async requireWhiteboard(
    ctx: PermissionContext,
    whiteboardId: Types.ObjectId,
    required: PermissionLevel,
    options: { includeDeleted?: boolean } = {},
  ): Promise<WhiteboardDocument> {
    const board = await this.model
      .findOne(
        options.includeDeleted
          ? { _id: whiteboardId, workspaceId: ctx.workspaceId }
          : { _id: whiteboardId, workspaceId: ctx.workspaceId, deletedAt: null },
      )
      .exec();

    if (!board) {
      throw this.notFound();
    }

    await this.requireLocation(ctx, board.locationType, board.locationId, required);

    return board;
  }

  /** Whiteboards matching the filter that the requester can at least see. */
  async visibleWhiteboards(
    ctx: PermissionContext,
    filter: Record<string, unknown> = {},
  ): Promise<WhiteboardDocument[]> {
    const boards = await this.model
      .find({ workspaceId: ctx.workspaceId, deletedAt: null, ...filter })
      .sort({ _id: -1 })
      .limit(MAX_WHITEBOARD_SCAN)
      .exec();
    const cache = new Map<string, boolean>();
    const visible: WhiteboardDocument[] = [];

    for (const board of boards) {
      const key = `${board.locationType}:${String(board.locationId)}`;
      let allowed = cache.get(key);

      if (allowed === undefined) {
        allowed = hasLevelAtLeast(
          await this.locationLevel(ctx, board.locationType, board.locationId),
          'view',
        );
        cache.set(key, allowed);
      }

      if (allowed) {
        visible.push(board);
      }
    }

    return visible;
  }

  private async chainLevel(
    ctx: PermissionContext,
    locationType: WhiteboardLocationType,
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
