import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Activity } from '../collaboration/schemas/activity.schema';
import { Attachment } from '../collaboration/schemas/attachment.schema';
import { Checklist } from '../collaboration/schemas/checklist.schema';
import { Comment } from '../collaboration/schemas/comment.schema';
import { TaskDependency } from '../collaboration/schemas/task-dependency.schema';
import { FavoritesService } from '../favorites/favorites.service';
import { RecentsService } from '../favorites/recents.service';
import { CustomField } from '../fields/schemas/custom-field.schema';
import { PermissionService } from '../hierarchy/permission.service';
import { Folder } from '../hierarchy/schemas/folder.schema';
import { List } from '../hierarchy/schemas/list.schema';
import { Space } from '../hierarchy/schemas/space.schema';
import { Notification } from '../notifications/schemas/notification.schema';
import { StorageService } from '../storage/storage.service';
import { Tag } from '../tasks/schemas/tag.schema';
import { Task } from '../tasks/schemas/task.schema';
import { View } from '../views/schemas/view.schema';
import { MAX_PURGE_SCAN, retentionCutoff } from './trash-fields';

export interface PurgeCounts {
  spaces: number;
  folders: number;
  lists: number;
  tasks: number;
}

/**
 * Permanent delete of what is in the trash. Every level cascades into what it
 * contains, so nothing is left pointing at an entity that no longer exists.
 */
@Injectable()
export class PurgeService {
  private readonly logger = new Logger(PurgeService.name);

  constructor(
    @InjectModel(Space.name) private readonly spaces: Model<Space>,
    @InjectModel(Folder.name) private readonly folders: Model<Folder>,
    @InjectModel(List.name) private readonly lists: Model<List>,
    @InjectModel(Task.name) private readonly tasks: Model<Task>,
    @InjectModel(Tag.name) private readonly tags: Model<Tag>,
    @InjectModel(Checklist.name) private readonly checklists: Model<Checklist>,
    @InjectModel(Comment.name) private readonly comments: Model<Comment>,
    @InjectModel(Attachment.name) private readonly attachments: Model<Attachment>,
    @InjectModel(TaskDependency.name) private readonly dependencies: Model<TaskDependency>,
    @InjectModel(Activity.name) private readonly activities: Model<Activity>,
    @InjectModel(CustomField.name) private readonly customFields: Model<CustomField>,
    @InjectModel(View.name) private readonly views: Model<View>,
    @InjectModel(Notification.name) private readonly notifications: Model<Notification>,
    private readonly permissions: PermissionService,
    private readonly favorites: FavoritesService,
    private readonly recents: RecentsService,
    private readonly storage: StorageService,
  ) {}

  /** Tasks, their subtasks and everything attached to them. */
  async purgeTasks(workspaceId: Types.ObjectId, taskIds: Types.ObjectId[]): Promise<void> {
    const ids = await this.withSubtasks(workspaceId, taskIds);

    if (ids.length === 0) {
      return;
    }

    const commentIds = (
      await this.comments
        .find({ workspaceId, entityType: 'task', entityId: { $in: ids } })
        .select('_id')
        .exec()
    ).map((comment) => comment._id);

    await this.removeFiles(workspaceId, ids);

    await Promise.all([
      this.checklists.deleteMany({ workspaceId, taskId: { $in: ids } }).exec(),
      this.comments.deleteMany({ workspaceId, entityType: 'task', entityId: { $in: ids } }).exec(),
      this.attachments.deleteMany({ workspaceId, taskId: { $in: ids } }).exec(),
      this.dependencies
        .deleteMany({ workspaceId, $or: [{ taskId: { $in: ids } }, { dependsOnId: { $in: ids } }] })
        .exec(),
      this.activities
        .deleteMany({
          workspaceId,
          $or: [{ taskId: { $in: ids } }, { entityId: { $in: [...ids, ...commentIds] } }],
        })
        .exec(),
      this.notifications
        .deleteMany({ workspaceId, entityId: { $in: [...ids, ...commentIds] } })
        .exec(),
    ]);

    await this.permissions.removeForResources(workspaceId, 'task', ids);
    await this.favorites.removeForEntities(workspaceId, 'task', ids);
    await this.recents.removeForEntities(workspaceId, 'task', ids);
    await this.tasks.deleteMany({ workspaceId, _id: { $in: ids } }).exec();
  }

  /** Lists and their tasks; a task that only had the List as secondary survives. */
  async purgeLists(workspaceId: Types.ObjectId, listIds: Types.ObjectId[]): Promise<void> {
    if (listIds.length === 0) {
      return;
    }

    const owned = await this.tasks
      .find({ workspaceId, listId: { $in: listIds } })
      .select('_id')
      .exec();

    await this.purgeTasks(
      workspaceId,
      owned.map((task) => task._id),
    );

    await this.tasks
      .updateMany(
        { workspaceId, listIds: { $in: listIds } },
        { $pull: { listIds: { $in: listIds } } },
      )
      .exec();

    await this.purgeLocations(workspaceId, 'list', listIds);
    await this.lists.deleteMany({ workspaceId, _id: { $in: listIds } }).exec();
  }

  /** Folders, the folders nested in them and their Lists. */
  async purgeFolders(workspaceId: Types.ObjectId, folderIds: Types.ObjectId[]): Promise<void> {
    if (folderIds.length === 0) {
      return;
    }

    const children = await this.folders
      .find({ workspaceId, parentFolderId: { $in: folderIds } })
      .select('_id')
      .exec();
    const ids = unique([...folderIds, ...children.map((folder) => folder._id)]);
    const lists = await this.lists
      .find({ workspaceId, folderId: { $in: ids } })
      .select('_id')
      .exec();

    await this.purgeLists(
      workspaceId,
      lists.map((list) => list._id),
    );

    await this.purgeLocations(workspaceId, 'folder', ids);
    await this.folders.deleteMany({ workspaceId, _id: { $in: ids } }).exec();
  }

  /** Spaces with their folders, Lists and tags. */
  async purgeSpaces(workspaceId: Types.ObjectId, spaceIds: Types.ObjectId[]): Promise<void> {
    if (spaceIds.length === 0) {
      return;
    }

    const folders = await this.folders
      .find({ workspaceId, spaceId: { $in: spaceIds } })
      .select('_id')
      .exec();

    await this.purgeFolders(
      workspaceId,
      folders.map((folder) => folder._id),
    );

    const lists = await this.lists
      .find({ workspaceId, spaceId: { $in: spaceIds } })
      .select('_id')
      .exec();

    await this.purgeLists(
      workspaceId,
      lists.map((list) => list._id),
    );

    await this.tags.deleteMany({ workspaceId, spaceId: { $in: spaceIds } }).exec();
    await this.purgeLocations(workspaceId, 'space', spaceIds);
    await this.spaces.deleteMany({ workspaceId, _id: { $in: spaceIds } }).exec();
  }

  /** Items whose `deletedAt` is older than the retention window. */
  async purgeExpired(now = new Date()): Promise<PurgeCounts> {
    const expired = { deletedAt: { $lte: retentionCutoff(now) } };
    const counts: PurgeCounts = { spaces: 0, folders: 0, lists: 0, tasks: 0 };

    const spaces = await this.spaces.find(expired).limit(MAX_PURGE_SCAN).exec();

    for (const space of spaces) {
      await this.purgeSpaces(space.workspaceId, [space._id]);
      counts.spaces += 1;
    }

    const folders = await this.folders.find(expired).limit(MAX_PURGE_SCAN).exec();

    for (const folder of folders) {
      await this.purgeFolders(folder.workspaceId, [folder._id]);
      counts.folders += 1;
    }

    const lists = await this.lists.find(expired).limit(MAX_PURGE_SCAN).exec();

    for (const list of lists) {
      await this.purgeLists(list.workspaceId, [list._id]);
      counts.lists += 1;
    }

    const tasks = await this.tasks.find(expired).limit(MAX_PURGE_SCAN).exec();

    for (const task of tasks) {
      await this.purgeTasks(task.workspaceId, [task._id]);
      counts.tasks += 1;
    }

    return counts;
  }

  /** Views, custom fields, permissions and favourites of a hierarchy location. */
  private async purgeLocations(
    workspaceId: Types.ObjectId,
    scope: 'space' | 'folder' | 'list',
    ids: Types.ObjectId[],
  ): Promise<void> {
    await Promise.all([
      this.customFields.deleteMany({ workspaceId, scope, scopeId: { $in: ids } }).exec(),
      this.views.deleteMany({ workspaceId, locationType: scope, locationId: { $in: ids } }).exec(),
    ]);

    await this.permissions.removeForResources(workspaceId, scope, ids);
    await this.favorites.removeForEntities(workspaceId, scope, ids);

    if (scope === 'list') {
      await this.recents.removeForEntities(workspaceId, 'list', ids);
    }
  }

  /** Every subtask under the given tasks, however deep the chain goes. */
  private async withSubtasks(
    workspaceId: Types.ObjectId,
    taskIds: Types.ObjectId[],
  ): Promise<Types.ObjectId[]> {
    const all = unique(taskIds);
    let frontier = all;

    while (frontier.length > 0) {
      const children = await this.tasks
        .find({ workspaceId, parentTaskId: { $in: frontier } })
        .select('_id')
        .exec();
      const known = new Set(all.map(String));

      frontier = children.map((task) => task._id).filter((id) => !known.has(String(id)));
      all.push(...frontier);
    }

    return all;
  }

  /** Drops the stored files; a storage failure never stops the purge. */
  private async removeFiles(workspaceId: Types.ObjectId, taskIds: Types.ObjectId[]): Promise<void> {
    const docs = await this.attachments
      .find({ workspaceId, taskId: { $in: taskIds } })
      .select('+storageKey')
      .exec();

    for (const attachment of docs) {
      try {
        await this.storage.remove(attachment.storageKey);
      } catch (error) {
        this.logger.warn(
          `Falha ao apagar o arquivo ${attachment.storageKey}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }
}

function unique(ids: Types.ObjectId[]): Types.ObjectId[] {
  const seen = new Set<string>();

  return ids.filter((id) => {
    const key = String(id);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;
  });
}
