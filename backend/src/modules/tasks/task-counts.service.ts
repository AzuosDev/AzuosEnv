import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Task } from './schemas/task.schema';

interface CountRow {
  _id: Types.ObjectId;
  count: number;
}

/**
 * Open task count per List, used by the sidebar tree. Lives in its own provider so
 * the hierarchy module can read it without depending on the tasks module.
 */
@Injectable()
export class TaskCountsService {
  constructor(@InjectModel(Task.name) private readonly tasks: Model<Task>) {}

  async openByList(workspaceId: Types.ObjectId): Promise<Map<string, number>> {
    const rows = await this.tasks
      .aggregate<CountRow>([
        {
          $match: {
            workspaceId,
            deletedAt: null,
            archivedAt: null,
            statusGroup: { $nin: ['done', 'closed'] },
          },
        },
        { $unwind: '$listIds' },
        { $group: { _id: '$listIds', count: { $sum: 1 } } },
      ])
      .exec();

    return new Map(rows.map((row) => [String(row._id), row.count]));
  }
}
