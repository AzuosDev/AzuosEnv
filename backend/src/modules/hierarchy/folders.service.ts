import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CursorPage } from '../../common/pagination/cursor';
import { CreateFolderDto, FolderQueryDto, MoveFolderDto, UpdateFolderDto } from './dto/folder.dto';
import { ReorderDto } from './dto/reorder.dto';
import { HierarchyAccessService } from './hierarchy-access.service';
import {
  appendPosition,
  paginateByPosition,
  positionBetweenSiblings,
  positionedModel,
} from './ordering';
import { PermissionContext, PermissionService } from './permission.service';
import { Folder, FolderDocument } from './schemas/folder.schema';
import { List } from './schemas/list.schema';
import { SpaceDocument } from './schemas/space.schema';
import { StatusSetsService } from './status-sets.service';

@Injectable()
export class FoldersService {
  constructor(
    @InjectModel(Folder.name) private readonly model: Model<Folder>,
    @InjectModel(List.name) private readonly lists: Model<List>,
    private readonly access: HierarchyAccessService,
    private readonly statusSets: StatusSetsService,
    private readonly permissions: PermissionService,
  ) {}

  async create(ctx: PermissionContext, dto: CreateFolderDto): Promise<FolderDocument> {
    const space = await this.access.requireSpace(ctx, new Types.ObjectId(dto.spaceId), 'edit');
    const parent = dto.parentFolderId
      ? await this.requireParent(ctx, new Types.ObjectId(dto.parentFolderId), space)
      : null;

    const folder = await this.model.create({
      workspaceId: ctx.workspaceId,
      spaceId: space._id,
      parentFolderId: parent?._id ?? null,
      name: dto.name,
      private: dto.private ?? false,
      statusSetId: dto.statusSetId
        ? await this.statusSets.requireOwned(ctx.workspaceId, dto.statusSetId)
        : null,
      position: await appendPosition(
        positionedModel(this.model),
        this.siblings(ctx, space._id, parent?._id ?? null),
      ),
    });

    if (folder.private) {
      await this.permissions.share(ctx.workspaceId, {
        resourceType: 'folder',
        resourceId: folder._id,
        principalType: 'user',
        principalId: ctx.userId,
        level: 'full',
        createdBy: ctx.userId,
      });
    }

    return folder;
  }

  async list(ctx: PermissionContext, query: FolderQueryDto): Promise<CursorPage<FolderDocument>> {
    const docs = await this.model.find(this.listFilter(ctx, query)).sort({ position: 1 }).exec();

    const explicit = await this.permissions.explicitLevels(ctx);
    const visible: FolderDocument[] = [];

    for (const folder of docs) {
      const chain = await this.access.folderChain(folder);

      if (this.permissions.canView(this.permissions.levelFromChain(ctx, chain, explicit))) {
        visible.push(folder);
      }
    }

    return paginateByPosition(visible, query);
  }

  get(ctx: PermissionContext, folderId: Types.ObjectId): Promise<FolderDocument> {
    return this.access.requireFolder(ctx, folderId, 'view');
  }

  async update(
    ctx: PermissionContext,
    folderId: Types.ObjectId,
    dto: UpdateFolderDto,
  ): Promise<FolderDocument> {
    const required = dto.private !== undefined || dto.statusSetId !== undefined ? 'full' : 'edit';
    const folder = await this.access.requireFolder(ctx, folderId, required);

    if (dto.name !== undefined) {
      folder.name = dto.name;
    }

    if (dto.private !== undefined) {
      folder.private = dto.private;
    }

    if (dto.statusSetId !== undefined) {
      folder.statusSetId = dto.statusSetId
        ? await this.statusSets.requireOwned(ctx.workspaceId, dto.statusSetId)
        : null;
    }

    return folder.save();
  }

  /** Moves the folder to another Space or in/out of a parent folder. */
  async move(
    ctx: PermissionContext,
    folderId: Types.ObjectId,
    dto: MoveFolderDto,
  ): Promise<FolderDocument> {
    const folder = await this.access.requireFolder(ctx, folderId, 'edit');
    const space = await this.access.requireSpace(
      ctx,
      dto.spaceId ? new Types.ObjectId(dto.spaceId) : folder.spaceId,
      'edit',
    );

    const parentId =
      dto.parentFolderId === undefined
        ? folder.parentFolderId
        : dto.parentFolderId === null
          ? null
          : new Types.ObjectId(dto.parentFolderId);

    const parent = parentId ? await this.requireParent(ctx, parentId, space, folder) : null;

    folder.spaceId = space._id;
    folder.parentFolderId = parent?._id ?? null;
    folder.position = await appendPosition(
      positionedModel(this.model),
      this.siblings(ctx, space._id, parent?._id ?? null),
    );

    await folder.save();
    await this.moveDescendants(folder);

    return folder;
  }

  async archive(ctx: PermissionContext, folderId: Types.ObjectId): Promise<FolderDocument> {
    const folder = await this.access.requireFolder(ctx, folderId, 'edit');

    if (folder.archivedAt) {
      return folder;
    }

    const at = new Date();

    folder.archivedAt = at;
    await folder.save();
    await this.cascadeArchive(folder, null, at);

    return folder;
  }

  async unarchive(ctx: PermissionContext, folderId: Types.ObjectId): Promise<FolderDocument> {
    const folder = await this.access.requireFolder(ctx, folderId, 'edit');
    const at = folder.archivedAt;

    if (!at) {
      return folder;
    }

    folder.archivedAt = null;
    await folder.save();
    await this.cascadeArchive(folder, at, null);

    return folder;
  }

  async remove(ctx: PermissionContext, folderId: Types.ObjectId): Promise<void> {
    const folder = await this.access.requireFolder(ctx, folderId, 'full');
    const at = new Date();

    folder.deletedAt = at;
    await folder.save();
    await this.cascadeDelete(folder, null, at);
  }

  async restore(ctx: PermissionContext, folderId: Types.ObjectId): Promise<FolderDocument> {
    const folder = await this.access.requireFolder(ctx, folderId, 'full', { includeDeleted: true });
    const at = folder.deletedAt;

    if (!at) {
      return folder;
    }

    folder.deletedAt = null;
    await folder.save();
    await this.cascadeDelete(folder, at, null);

    return folder;
  }

  async reorder(
    ctx: PermissionContext,
    folderId: Types.ObjectId,
    dto: ReorderDto,
  ): Promise<FolderDocument> {
    const folder = await this.access.requireFolder(ctx, folderId, 'edit');

    folder.position = await positionBetweenSiblings(
      positionedModel(this.model),
      this.siblings(ctx, folder.spaceId, folder.parentFolderId),
      dto.previousId ? new Types.ObjectId(dto.previousId) : null,
      dto.nextId ? new Types.ObjectId(dto.nextId) : null,
    );

    return folder.save();
  }

  /** A subfolder cannot hold another one: the hierarchy stops at depth 2. */
  private async requireParent(
    ctx: PermissionContext,
    parentFolderId: Types.ObjectId,
    space: SpaceDocument,
    moving?: FolderDocument,
  ): Promise<FolderDocument> {
    const parent = await this.access.requireFolder(ctx, parentFolderId, 'edit');

    if (String(parent.spaceId) !== String(space._id)) {
      throw new BadRequestException({
        code: 'INVALID_FOLDER_PARENT',
        message: 'O folder pai deve estar no mesmo Space.',
      });
    }

    if (parent.parentFolderId) {
      throw new BadRequestException({
        code: 'FOLDER_DEPTH_EXCEEDED',
        message: 'Uma subfolder não pode conter outras subfolders.',
      });
    }

    if (moving && String(parent._id) === String(moving._id)) {
      throw new BadRequestException({
        code: 'INVALID_FOLDER_PARENT',
        message: 'Um folder não pode ser pai de si mesmo.',
      });
    }

    if (moving) {
      const hasChildren = await this.model
        .countDocuments({ workspaceId: ctx.workspaceId, parentFolderId: moving._id })
        .exec();

      if (hasChildren > 0) {
        throw new BadRequestException({
          code: 'FOLDER_DEPTH_EXCEEDED',
          message: 'Um folder com subfolders não pode virar subfolder.',
        });
      }
    }

    return parent;
  }

  private siblings(
    ctx: PermissionContext,
    spaceId: Types.ObjectId,
    parentFolderId: Types.ObjectId | null,
  ): Record<string, unknown> {
    return { workspaceId: ctx.workspaceId, spaceId, parentFolderId, deletedAt: null };
  }

  private listFilter(ctx: PermissionContext, query: FolderQueryDto): Record<string, unknown> {
    const filter: Record<string, unknown> = {
      workspaceId: ctx.workspaceId,
      deletedAt: null,
    };

    if (query.spaceId) {
      filter.spaceId = new Types.ObjectId(query.spaceId);
    }

    if (!query.includeArchived) {
      filter.archivedAt = null;
    }

    if (query.parentFolderId) {
      filter.parentFolderId = new Types.ObjectId(query.parentFolderId);
    }

    return filter;
  }

  /** Subfolders and lists follow the folder when it changes Space. */
  private async moveDescendants(folder: FolderDocument): Promise<void> {
    const base = { workspaceId: folder.workspaceId };
    const subfolders = await this.model
      .find({ ...base, parentFolderId: folder._id })
      .select('_id')
      .exec();
    const folderIds = [folder._id, ...subfolders.map((sub) => sub._id)];

    await Promise.all([
      this.model
        .updateMany({ ...base, parentFolderId: folder._id }, { $set: { spaceId: folder.spaceId } })
        .exec(),
      this.lists
        .updateMany(
          { ...base, folderId: { $in: folderIds } },
          { $set: { spaceId: folder.spaceId } },
        )
        .exec(),
    ]);
  }

  private async cascadeDelete(
    folder: FolderDocument,
    from: Date | null,
    to: Date | null,
  ): Promise<void> {
    const folderIds = await this.descendantFolderIds(folder);

    await Promise.all([
      this.model
        .updateMany(
          { workspaceId: folder.workspaceId, parentFolderId: folder._id, deletedAt: from },
          { $set: { deletedAt: to } },
        )
        .exec(),
      this.lists
        .updateMany(
          { workspaceId: folder.workspaceId, folderId: { $in: folderIds }, deletedAt: from },
          { $set: { deletedAt: to } },
        )
        .exec(),
    ]);
  }

  private async cascadeArchive(
    folder: FolderDocument,
    from: Date | null,
    to: Date | null,
  ): Promise<void> {
    const folderIds = await this.descendantFolderIds(folder);

    await Promise.all([
      this.model
        .updateMany(
          { workspaceId: folder.workspaceId, parentFolderId: folder._id, archivedAt: from },
          { $set: { archivedAt: to } },
        )
        .exec(),
      this.lists
        .updateMany(
          { workspaceId: folder.workspaceId, folderId: { $in: folderIds }, archivedAt: from },
          { $set: { archivedAt: to } },
        )
        .exec(),
    ]);
  }

  private async descendantFolderIds(folder: FolderDocument): Promise<Types.ObjectId[]> {
    const subfolders = await this.model
      .find({ workspaceId: folder.workspaceId, parentFolderId: folder._id })
      .select('_id')
      .exec();

    return [folder._id, ...subfolders.map((sub) => sub._id)];
  }
}
