import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PermissionLevel } from './permission-levels';
import {
  ExplicitLevels,
  PermissionContext,
  PermissionService,
  ResourceRef,
} from './permission.service';
import { Folder, FolderDocument } from './schemas/folder.schema';
import { List, ListDocument } from './schemas/list.schema';
import { Space, SpaceDocument } from './schemas/space.schema';

export interface LoadOptions {
  /** Needed by restore, which has to find the soft-deleted document. */
  includeDeleted?: boolean;
}

/**
 * Loads Spaces, Folders and Lists of the workspace, builds the inheritance chain
 * of each one and enforces the level required by the caller.
 */
@Injectable()
export class HierarchyAccessService {
  constructor(
    @InjectModel(Space.name) private readonly spaces: Model<Space>,
    @InjectModel(Folder.name) private readonly folders: Model<Folder>,
    @InjectModel(List.name) private readonly lists: Model<List>,
    private readonly permissions: PermissionService,
  ) {}

  spaceNotFound(): NotFoundException {
    return new NotFoundException({ code: 'SPACE_NOT_FOUND', message: 'Space não encontrado.' });
  }

  folderNotFound(): NotFoundException {
    return new NotFoundException({ code: 'FOLDER_NOT_FOUND', message: 'Folder não encontrado.' });
  }

  listNotFound(): NotFoundException {
    return new NotFoundException({ code: 'LIST_NOT_FOUND', message: 'List não encontrada.' });
  }

  spaceRef(space: SpaceDocument): ResourceRef {
    return { resourceType: 'space', resourceId: space._id, private: space.private };
  }

  spaceChain(space: SpaceDocument): ResourceRef[] {
    return [this.spaceRef(space)];
  }

  /** [space, folder pai?, folder] */
  async folderChain(folder: FolderDocument): Promise<ResourceRef[]> {
    const space = await this.spaces
      .findOne({ _id: folder.spaceId, workspaceId: folder.workspaceId })
      .exec();

    if (!space) {
      throw this.folderNotFound();
    }

    const chain = this.spaceChain(space);

    if (folder.parentFolderId) {
      const parent = await this.folders
        .findOne({ _id: folder.parentFolderId, workspaceId: folder.workspaceId })
        .exec();

      if (parent) {
        chain.push({
          resourceType: 'folder',
          resourceId: parent._id,
          private: parent.private,
        });
      }
    }

    chain.push({ resourceType: 'folder', resourceId: folder._id, private: folder.private });

    return chain;
  }

  /** [space, folder..., list] */
  async listChain(list: ListDocument): Promise<ResourceRef[]> {
    const chain = list.folderId ? await this.folderChainById(list) : await this.spaceChainOf(list);

    chain.push({ resourceType: 'list', resourceId: list._id });

    return chain;
  }

  async requireSpace(
    ctx: PermissionContext,
    spaceId: Types.ObjectId,
    required: PermissionLevel,
    options: LoadOptions = {},
  ): Promise<SpaceDocument> {
    const space = await this.spaces
      .findOne(
        options.includeDeleted
          ? { _id: spaceId, workspaceId: ctx.workspaceId }
          : { _id: spaceId, workspaceId: ctx.workspaceId, deletedAt: null },
      )
      .exec();

    if (!space) {
      throw this.spaceNotFound();
    }

    const level = await this.permissions.levelFor(ctx, this.spaceChain(space));

    this.permissions.assertLevel(level, required, () => this.spaceNotFound());

    return space;
  }

  async requireFolder(
    ctx: PermissionContext,
    folderId: Types.ObjectId,
    required: PermissionLevel,
    options: LoadOptions = {},
  ): Promise<FolderDocument> {
    const folder = await this.folders
      .findOne(
        options.includeDeleted
          ? { _id: folderId, workspaceId: ctx.workspaceId }
          : { _id: folderId, workspaceId: ctx.workspaceId, deletedAt: null },
      )
      .exec();

    if (!folder) {
      throw this.folderNotFound();
    }

    const level = await this.permissions.levelFor(ctx, await this.folderChain(folder));

    this.permissions.assertLevel(level, required, () => this.folderNotFound());

    return folder;
  }

  async requireList(
    ctx: PermissionContext,
    listId: Types.ObjectId,
    required: PermissionLevel,
    options: LoadOptions = {},
  ): Promise<ListDocument> {
    const list = await this.lists
      .findOne(
        options.includeDeleted
          ? { _id: listId, workspaceId: ctx.workspaceId }
          : { _id: listId, workspaceId: ctx.workspaceId, deletedAt: null },
      )
      .exec();

    if (!list) {
      throw this.listNotFound();
    }

    const level = await this.permissions.levelFor(ctx, await this.listChain(list));

    this.permissions.assertLevel(level, required, () => this.listNotFound());

    return list;
  }

  /** Spaces the requester can at least see, in manual order. */
  async visibleSpaces(
    ctx: PermissionContext,
    options: { includeArchived?: boolean } = {},
  ): Promise<SpaceDocument[]> {
    const filter = options.includeArchived
      ? { workspaceId: ctx.workspaceId, deletedAt: null }
      : { workspaceId: ctx.workspaceId, deletedAt: null, archivedAt: null };

    const spaces = await this.spaces.find(filter).sort({ position: 1 }).exec();
    const explicit = await this.permissions.explicitLevels(ctx);

    return spaces.filter((space) =>
      this.permissions.canView(
        this.permissions.levelFromChain(ctx, this.spaceChain(space), explicit),
      ),
    );
  }

  private async spaceChainOf(list: ListDocument): Promise<ResourceRef[]> {
    const space = await this.spaces
      .findOne({ _id: list.spaceId, workspaceId: list.workspaceId })
      .exec();

    if (!space) {
      throw this.listNotFound();
    }

    return this.spaceChain(space);
  }

  private async folderChainById(list: ListDocument): Promise<ResourceRef[]> {
    const folder = await this.folders
      .findOne({ _id: list.folderId, workspaceId: list.workspaceId })
      .exec();

    if (!folder) {
      return this.spaceChainOf(list);
    }

    return this.folderChain(folder);
  }

  /** Visible descendants of the chains already loaded, used by the sidebar tree. */
  visibleBy<T>(
    ctx: PermissionContext,
    explicit: ExplicitLevels,
    items: T[],
    chainOf: (item: T) => ResourceRef[],
  ): T[] {
    return items.filter((item) =>
      this.permissions.canView(this.permissions.levelFromChain(ctx, chainOf(item), explicit)),
    );
  }
}
