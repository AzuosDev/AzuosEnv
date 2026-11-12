import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CursorPage, buildCursorPage, decodeObjectIdCursor } from '../../common/pagination/cursor';
import { DEFAULT_PAGE_SIZE } from '../../common/pagination/pagination-query.dto';
import { AutomationRunStatus } from './automation-fields';
import { AutomationRunQueryDto } from './dto/automation.dto';
import { AutomationRun, AutomationRunDocument } from './schemas/automation-run.schema';

export interface RecordRunInput {
  workspaceId: Types.ObjectId;
  automationId: Types.ObjectId;
  eventId: string;
  status: AutomationRunStatus;
  error?: string | null;
  actionsExecuted?: number;
  durationMs?: number;
  taskId?: Types.ObjectId | null;
}

@Injectable()
export class AutomationRunsService {
  constructor(@InjectModel(AutomationRun.name) private readonly model: Model<AutomationRun>) {}

  record(input: RecordRunInput): Promise<AutomationRunDocument> {
    return this.model.create({
      workspaceId: input.workspaceId,
      automationId: input.automationId,
      eventId: input.eventId,
      status: input.status,
      error: input.error ?? null,
      actionsExecuted: input.actionsExecuted ?? 0,
      durationMs: input.durationMs ?? 0,
      taskId: input.taskId ?? null,
    });
  }

  async list(
    workspaceId: Types.ObjectId,
    automationId: Types.ObjectId,
    query: AutomationRunQueryDto,
  ): Promise<CursorPage<AutomationRunDocument>> {
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const after = query.cursor ? decodeObjectIdCursor(query.cursor) : null;
    const base = {
      workspaceId,
      automationId,
      ...(query.status ? { status: query.status } : {}),
    };

    const docs = await this.model
      .find(after ? { ...base, _id: { $lt: after } } : base)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .exec();

    return buildCursorPage(docs, limit, (doc) => ({ id: String(doc._id) }));
  }

  /** True when the automation already ran for this event; the due-date cron dedupes with it. */
  async alreadyRan(
    workspaceId: Types.ObjectId,
    automationId: Types.ObjectId,
    eventId: string,
  ): Promise<boolean> {
    return (await this.model.countDocuments({ workspaceId, automationId, eventId })) > 0;
  }
}
