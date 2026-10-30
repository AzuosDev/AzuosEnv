import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import { STATUS_GROUPS, StatusGroup } from '../status-templates';

@Schema({ _id: true })
export class Status {
  _id: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  color: string;

  @Prop({ type: String, enum: STATUS_GROUPS, required: true })
  group: StatusGroup;

  @Prop({ required: true })
  position: number;
}

export const StatusSchema = SchemaFactory.createForClass(Status);

@Schema({ collection: 'status_sets', ...baseSchemaOptions })
export class StatusSet {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: [StatusSchema], default: [] })
  statuses: Status[];
}

export type StatusSetDocument = HydratedDocument<StatusSet>;

export const StatusSetSchema = SchemaFactory.createForClass(StatusSet);
