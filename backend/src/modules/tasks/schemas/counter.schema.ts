import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';

/** Atomic sequence per workspace; `key` is the counter name (e.g. `task`). */
@Schema({ collection: 'counters', ...baseSchemaOptions })
export class Counter {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ required: true })
  key: string;

  @Prop({ type: Number, required: true, default: 0 })
  seq: number;
}

export type CounterDocument = HydratedDocument<Counter>;

export const CounterSchema = SchemaFactory.createForClass(Counter);

CounterSchema.index({ workspaceId: 1, key: 1 }, { unique: true });
