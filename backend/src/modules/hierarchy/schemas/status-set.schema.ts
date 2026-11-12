import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import { STATUS_GROUPS, StatusGroup } from '../status-templates';

/** Statuses are referenced by id by the tasks, so they follow the same `id` shape. */
@Schema({ _id: true, ...baseSchemaOptions, timestamps: false })
export class Status {
  @ApiHideProperty()
  _id: Types.ObjectId;

  /** Só para o contrato: o toJSON manda `id`, nunca `_id`. */
  @ApiProperty({ required: true, description: 'Id do status.' })
  id?: string;

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
