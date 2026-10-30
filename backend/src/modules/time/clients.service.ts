import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Folder } from '../hierarchy/schemas/folder.schema';
import { List } from '../hierarchy/schemas/list.schema';
import { Space } from '../hierarchy/schemas/space.schema';

/** The List and the client it belongs to; the Folder is the client, else the Space. */
export interface ClientInfo {
  listId: string;
  listName: string;
  client: string;
  clientType: 'folder' | 'space';
  clientId: string;
}

/** Resolves the client shown in the timesheet and in the time dashboards. */
@Injectable()
export class ClientsService {
  constructor(
    @InjectModel(List.name) private readonly lists: Model<List>,
    @InjectModel(Folder.name) private readonly folders: Model<Folder>,
    @InjectModel(Space.name) private readonly spaces: Model<Space>,
  ) {}

  async forLists(
    workspaceId: Types.ObjectId,
    listIds: Types.ObjectId[],
  ): Promise<Map<string, ClientInfo>> {
    if (listIds.length === 0) {
      return new Map();
    }

    const lists = await this.lists
      .find({ workspaceId, _id: { $in: listIds } })
      .select('name spaceId folderId')
      .exec();

    const folders = await this.folders
      .find({
        workspaceId,
        _id: { $in: lists.map((list) => list.folderId).filter((id) => id !== null) },
      })
      .select('name')
      .exec();

    const spaces = await this.spaces
      .find({ workspaceId, _id: { $in: lists.map((list) => list.spaceId) } })
      .select('name')
      .exec();

    const folderNames = new Map(folders.map((folder) => [String(folder._id), folder.name]));
    const spaceNames = new Map(spaces.map((space) => [String(space._id), space.name]));
    const result = new Map<string, ClientInfo>();

    for (const list of lists) {
      const folderName = list.folderId ? folderNames.get(String(list.folderId)) : undefined;

      result.set(String(list._id), {
        listId: String(list._id),
        listName: list.name,
        client: folderName ?? spaceNames.get(String(list.spaceId)) ?? '',
        clientType: folderName ? 'folder' : 'space',
        clientId: String(folderName && list.folderId ? list.folderId : list.spaceId),
      });
    }

    return result;
  }
}
