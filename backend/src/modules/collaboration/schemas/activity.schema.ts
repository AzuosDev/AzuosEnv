import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_ENTITY_TYPES,
  ActivityAction,
  ActivityEntityType,
} from '../collaboration-fields';

/** One line of the history: the field and its values before and after. */
@Schema({ _id: false })
export class ActivityChange {
  @Prop({ required: true })
  field: string;

  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  from: unknown;

  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  to: unknown;
}

export const ActivityChangeSchema = SchemaFactory.createForClass(ActivityChange);

@Schema({ collection: 'activities', ...baseSchemaOptions })
export class Activity {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: String, enum: ACTIVITY_ENTITY_TYPES, required: true })
  entityType: ActivityEntityType;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  entityId: Types.ObjectId;

  @Prop({ type: String, enum: ACTIVITY_ACTIONS, required: true })
  action: ActivityAction;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  actorId: Types.ObjectId;

  @Prop({ type: [ActivityChangeSchema], default: [] })
  changes: ActivityChange[];

  /** Task the entry belongs to, so the task feed reads one filter. */
  @Prop({ type: Types.ObjectId, ref: 'Task', default: null, index: true })
  taskId: Types.ObjectId | null;

  /** List of the task when the entry was written; drives the Activity view filter. */
  @Prop({ type: Types.ObjectId, ref: 'List', default: null, index: true })
  listId: Types.ObjectId | null;
}

export type ActivityDocument = HydratedDocument<Activity>;

export const ActivitySchema = SchemaFactory.createForClass(Activity);

ActivitySchema.index({ workspaceId: 1, taskId: 1, _id: -1 });
ActivitySchema.index({ workspaceId: 1, listId: 1, _id: -1 });
