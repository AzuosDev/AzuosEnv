import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';

@Schema({ collection: 'lists', ...baseSchemaOptions })
export class List {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Space', required: true, index: true })
  spaceId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Folder', default: null })
  folderId: Types.ObjectId | null;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop()
  color?: string;

  @Prop()
  description?: string;

  @Prop({ type: Types.ObjectId, ref: 'StatusSet', default: null })
  statusSetId: Types.ObjectId | null;

  @Prop({ required: true })
  position: string;

  /** Set when the List is a sprint of a sprint folder (ClickApp sprints). */
  @Prop({ type: Types.ObjectId, ref: 'SprintFolder', default: null })
  sprintFolderId: Types.ObjectId | null;

  /** First and last day of the sprint; null on an ordinary List. */
  @Prop({ type: Date, default: null })
  startDate: Date | null;

  @Prop({ type: Date, default: null })
  endDate: Date | null;

  /** When the sprint was closed and its leftovers were moved on. */
  @Prop({ type: Date, default: null })
  sprintClosedAt: Date | null;

  @Prop({ type: Date, default: null })
  archivedAt: Date | null;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export type ListDocument = HydratedDocument<List>;

export const ListSchema = SchemaFactory.createForClass(List);

ListSchema.index({ workspaceId: 1, spaceId: 1, folderId: 1, deletedAt: 1, position: 1 });
ListSchema.index({ workspaceId: 1, sprintFolderId: 1, startDate: 1 });
