import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import { CARD_TYPES, CardType } from '../dashboard-cards';

/** One card of the grid; `config` is validated by the DTO before it is stored. */
@Schema({ _id: false })
export class DashboardCard {
  @Prop({ required: true })
  id: string;

  @Prop({ type: String, enum: CARD_TYPES, required: true })
  type: CardType;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  config: Record<string, unknown>;

  @Prop({ type: Number, default: 0 })
  x: number;

  @Prop({ type: Number, default: 0 })
  y: number;

  @Prop({ type: Number, default: 4 })
  w: number;

  @Prop({ type: Number, default: 4 })
  h: number;
}

export const DashboardCardSchema = SchemaFactory.createForClass(DashboardCard);

@Schema({ collection: 'dashboards', ...baseSchemaOptions })
export class Dashboard {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  ownerId: Types.ObjectId;

  /** Private dashboards are invisible to everyone but the owner. */
  @Prop({ type: Boolean, default: false })
  private: boolean;

  @Prop({ type: [DashboardCardSchema], default: [] })
  cards: DashboardCard[];
}

export type DashboardDocument = HydratedDocument<Dashboard>;

export const DashboardSchema = SchemaFactory.createForClass(Dashboard);

DashboardSchema.index({ workspaceId: 1, _id: -1 });
