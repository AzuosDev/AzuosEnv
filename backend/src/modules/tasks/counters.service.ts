import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Counter } from './schemas/counter.schema';

const TASK_COUNTER_KEY = 'task';
const MAX_ATTEMPTS = 5;

function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000;
}

@Injectable()
export class CountersService {
  constructor(@InjectModel(Counter.name) private readonly model: Model<Counter>) {}

  /** Next value of the counter; the `$inc` upsert is atomic even in parallel. */
  async next(workspaceId: Types.ObjectId, key = TASK_COUNTER_KEY): Promise<number> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const doc = await this.model
          .findOneAndUpdate(
            { workspaceId, key },
            { $inc: { seq: 1 } },
            { returnDocument: 'after', upsert: true },
          )
          .exec();

        return doc.seq;
      } catch (error) {
        // Two parallel upserts can race on the unique index; the retry finds the document.
        if (!isDuplicateKey(error) || attempt === MAX_ATTEMPTS) {
          throw error;
        }
      }
    }

    throw new Error('Counter sequence could not be allocated.');
  }

  /** Visible task id of the workspace: PREFIX-n. */
  async nextCustomId(workspaceId: Types.ObjectId, prefix: string): Promise<string> {
    return `${prefix}-${await this.next(workspaceId)}`;
  }

  /** Raises the counter so the next id is greater than `seq`; used by the seed. */
  async ensureAtLeast(workspaceId: Types.ObjectId, seq: number, key = TASK_COUNTER_KEY) {
    await this.model
      .findOneAndUpdate(
        { workspaceId, key },
        { $max: { seq } },
        { returnDocument: 'after', upsert: true },
      )
      .exec();
  }
}
