import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import { WhiteboardElement } from '../whiteboard-elements';
import { WHITEBOARD_LOCATION_TYPES, WhiteboardLocationType } from '../whiteboard-fields';

@Schema({ collection: 'whiteboards', ...baseSchemaOptions })
export class Whiteboard {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: String, enum: WHITEBOARD_LOCATION_TYPES, required: true })
  locationType: WhiteboardLocationType;

  /** null only when `locationType` is `workspace`. */
  @Prop({ type: Types.ObjectId, default: null })
  locationId: Types.ObjectId | null;

  @Prop({ required: true, trim: true })
  title: string;

  /** Notes, shapes, connectors, text and freehand strokes of the canvas. */
  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
  elements: WhiteboardElement[];

  /** Bumped on every saved batch; a PATCH with another value is a conflict. */
  @Prop({ type: Number, default: 1 })
  version: number;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  updatedBy: Types.ObjectId;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export type WhiteboardDocument = HydratedDocument<Whiteboard>;

export const WhiteboardSchema = SchemaFactory.createForClass(Whiteboard);

WhiteboardSchema.index({ workspaceId: 1, locationType: 1, locationId: 1, _id: -1 });
WhiteboardSchema.index({ workspaceId: 1, deletedAt: 1, _id: -1 });
