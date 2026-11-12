import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import {
  AUTOMATION_RUN_STATUSES,
  AUTOMATION_RUN_TTL_SECONDS,
  AutomationRunStatus,
} from '../automation-fields';

/** One attempt of one automation over one event; kept for 90 days by the TTL index. */
@Schema({ collection: 'automation_runs', ...baseSchemaOptions })
export class AutomationRun {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Automation', required: true })
  automationId: Types.ObjectId;

  /** Identifies the event instance; the due-date cron uses it to avoid refiring. */
  @Prop({ required: true })
  eventId: string;

  @Prop({ type: String, enum: AUTOMATION_RUN_STATUSES, required: true })
  status: AutomationRunStatus;

  @Prop({ type: String, default: null })
  error: string | null;

  @Prop({ type: Number, default: 0 })
  actionsExecuted: number;

  @Prop({ type: Number, default: 0 })
  durationMs: number;

  @Prop({ type: Types.ObjectId, ref: 'Task', default: null })
  taskId: Types.ObjectId | null;
}

export type AutomationRunDocument = HydratedDocument<AutomationRun>;

export const AutomationRunSchema = SchemaFactory.createForClass(AutomationRun);

AutomationRunSchema.index({ workspaceId: 1, automationId: 1, _id: -1 });
AutomationRunSchema.index({ workspaceId: 1, automationId: 1, eventId: 1 });
AutomationRunSchema.index({ createdAt: 1 }, { expireAfterSeconds: AUTOMATION_RUN_TTL_SECONDS });
