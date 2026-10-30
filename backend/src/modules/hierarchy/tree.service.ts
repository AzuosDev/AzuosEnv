import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TaskCountsService } from '../tasks/task-counts.service';
import { HierarchyAccessService } from './hierarchy-access.service';
import { PermissionContext, PermissionService, ResourceRef } from './permission.service';
import { Folder, FolderDocument } from './schemas/folder.schema';
import { List, ListDocument } from './schemas/list.schema';
import { Space, SpaceDocument } from './schemas/space.schema';

export interface TreeList {
  id: string;
  name: string;
  color?: string;
  position: string;
  openTaskCount: number;
}

export interface TreeFolder {
  id: string;
  name: string;
  private: boolean;
  position: string;
  folders: TreeFolder[];
  lists: TreeList[];
}

export interface TreeSpace {
  id: string;
  name: string;
  color: string;
  icon?: string;
  private: boolean;
  position: string;
  folders: TreeFolder[];
  lists: TreeList[];
}

export interface WorkspaceTree {
  spaces: TreeSpace[];
}

/**
 * Sidebar tree. Shows what the requester can see, plus the Spaces and Folders
 * needed to reach a shared item inside them.
 */
@Injectable()
export class TreeService {
  constructor(
    @InjectModel(Space.name) private readonly spaces: Model<Space>,
    @InjectModel(Folder.name) private readonly folders: Model<Folder>,
    @InjectModel(List.name) private readonly lists: Model<List>,
    private readonly access: HierarchyAccessService,
    private readonly permissions: PermissionService,
    private readonly taskCounts: TaskCountsService,
  ) {}

  async build(ctx: PermissionContext): Promise<WorkspaceTree> {
    const active = { workspaceId: ctx.workspaceId, deletedAt: null, archivedAt: null };
    const [spaces, folders, lists, explicit] = await Promise.all([
      this.spaces.find(active).sort({ position: 1 }).exec(),
      this.folders.find(active).sort({ position: 1 }).exec(),
      this.lists.find(active).sort({ position: 1 }).exec(),
      this.permissions.explicitLevels(ctx),
    ]);

    const spaceById = new Map(spaces.map((space) => [String(space._id), space]));
    const folderById = new Map(folders.map((folder) => [String(folder._id), folder]));
    const canView = (chain: ResourceRef[]): boolean =>
      this.permissions.canView(this.permissions.levelFromChain(ctx, chain, explicit));

    const visibleLists = lists.filter((list) =>
      canView(this.listChain(list, spaceById, folderById)),
    );
    const visibleListIds = new Set(visibleLists.map((list) => String(list._id)));
    const includedFolderIds = this.includedFolders(folders, visibleLists, (folder) =>
      canView(this.folderChain(folder, spaceById, folderById)),
    );

    const includedFolders = folders.filter((folder) => includedFolderIds.has(String(folder._id)));

    const tree: WorkspaceTree = {
      spaces: spaces
        .filter(
          (space) =>
            canView(this.access.spaceChain(space)) ||
            includedFolders.some((folder) => String(folder.spaceId) === String(space._id)) ||
            visibleLists.some((list) => String(list.spaceId) === String(space._id)),
        )
        .map((space) => this.toTreeSpace(space, includedFolders, visibleLists, visibleListIds)),
    };

    this.fillOpenTaskCounts(tree.spaces, await this.taskCounts.openByList(ctx.workspaceId));

    return tree;
  }

  /** Fills openTaskCount after the tree is assembled. */
  private fillOpenTaskCounts(nodes: (TreeSpace | TreeFolder)[], counts: Map<string, number>): void {
    for (const node of nodes) {
      for (const list of node.lists) {
        list.openTaskCount = counts.get(list.id) ?? 0;
      }

      this.fillOpenTaskCounts(node.folders, counts);
    }
  }

  /** A Folder enters the tree when it is visible or holds something visible. */
  private includedFolders(
    folders: FolderDocument[],
    visibleLists: ListDocument[],
    isVisible: (folder: FolderDocument) => boolean,
  ): Set<string> {
    const included = new Set<string>();
    const holdsList = (folder: FolderDocument): boolean =>
      visibleLists.some((list) => String(list.folderId) === String(folder._id));

    for (const folder of folders.filter((item) => item.parentFolderId)) {
      if (isVisible(folder) || holdsList(folder)) {
        included.add(String(folder._id));
      }
    }

    for (const folder of folders.filter((item) => !item.parentFolderId)) {
      const holdsSubfolder = folders.some(
        (child) =>
          String(child.parentFolderId) === String(folder._id) && included.has(String(child._id)),
      );

      if (isVisible(folder) || holdsList(folder) || holdsSubfolder) {
        included.add(String(folder._id));
      }
    }

    return included;
  }

  private toTreeSpace(
    space: SpaceDocument,
    folders: FolderDocument[],
    lists: ListDocument[],
    visibleListIds: Set<string>,
  ): TreeSpace {
    const inSpace = folders.filter((folder) => String(folder.spaceId) === String(space._id));

    return {
      id: String(space._id),
      name: space.name,
      color: space.color,
      icon: space.icon,
      private: space.private,
      position: space.position,
      folders: inSpace
        .filter((folder) => !folder.parentFolderId)
        .map((folder) => this.toTreeFolder(folder, inSpace, lists, visibleListIds)),
      lists: lists
        .filter((list) => String(list.spaceId) === String(space._id) && !list.folderId)
        .map((list) => this.toTreeList(list)),
    };
  }

  private toTreeFolder(
    folder: FolderDocument,
    siblings: FolderDocument[],
    lists: ListDocument[],
    visibleListIds: Set<string>,
  ): TreeFolder {
    return {
      id: String(folder._id),
      name: folder.name,
      private: folder.private,
      position: folder.position,
      folders: siblings
        .filter((child) => String(child.parentFolderId) === String(folder._id))
        .map((child) => this.toTreeFolder(child, siblings, lists, visibleListIds)),
      lists: lists
        .filter(
          (list) =>
            String(list.folderId) === String(folder._id) && visibleListIds.has(String(list._id)),
        )
        .map((list) => this.toTreeList(list)),
    };
  }

  private toTreeList(list: ListDocument): TreeList {
    return {
      id: String(list._id),
      name: list.name,
      color: list.color,
      position: list.position,
      openTaskCount: 0,
    };
  }

  private folderChain(
    folder: FolderDocument,
    spaceById: Map<string, SpaceDocument>,
    folderById: Map<string, FolderDocument>,
  ): ResourceRef[] {
    const chain: ResourceRef[] = [];
    const space = spaceById.get(String(folder.spaceId));

    if (space) {
      chain.push(this.access.spaceRef(space));
    }

    const parent = folder.parentFolderId
      ? folderById.get(String(folder.parentFolderId))
      : undefined;

    if (parent) {
      chain.push({ resourceType: 'folder', resourceId: parent._id, private: parent.private });
    }

    chain.push({ resourceType: 'folder', resourceId: folder._id, private: folder.private });

    return chain;
  }

  private listChain(
    list: ListDocument,
    spaceById: Map<string, SpaceDocument>,
    folderById: Map<string, FolderDocument>,
  ): ResourceRef[] {
    const folder = list.folderId ? folderById.get(String(list.folderId)) : undefined;
    const chain = folder ? this.folderChain(folder, spaceById, folderById) : [];

    if (!folder) {
      const space = spaceById.get(String(list.spaceId));

      if (space) {
        chain.push(this.access.spaceRef(space));
      }
    }

    chain.push({ resourceType: 'list', resourceId: list._id });

    return chain;
  }
}
