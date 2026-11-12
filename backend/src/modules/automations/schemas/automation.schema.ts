import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiHideProperty } from '@nestjs/swagger';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import {
  ACTION_TYPES,
  AUTOMATION_LOCATION_TYPES,
  ActionType,
  AutomationLocationType,
  TRIGGER_TYPES,
  TriggerType,
} from '../automation-fields';
import { CONDITION_OPS, ConditionOp } from '../automation-conditions';

/** What starts the automation; `params` is validated by the DTO before it is stored. */
@Schema({ _id: false })
export class AutomationTrigger {
  @Prop({ type: String, enum: TRIGGER_TYPES, required: true })
  type: TriggerType;

  @Prop({ type: MongooseSchema.Types.Mixed, default: () => ({}) })
  params: Record<string, unknown>;
}

export const AutomationTriggerSchema = SchemaFactory.createForClass(AutomationTrigger);

/** Every condition must pass for the actions to run. */
@Schema({ _id: false })
export class AutomationCondition {
  @Prop({ required: true, trim: true })
  field: string;

  @Prop({ type: String, enum: CONDITION_OPS, required: true })
  op: ConditionOp;

  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  value: unknown;
}

export const AutomationConditionSchema = SchemaFactory.createForClass(AutomationCondition);

@Schema({ _id: false })
export class AutomationAction {
  @Prop({ type: String, enum: ACTION_TYPES, required: true })
  type: ActionType;

  @Prop({ type: MongooseSchema.Types.Mixed, default: () => ({}) })
  params: Record<string, unknown>;
}

export const AutomationActionSchema = SchemaFactory.createForClass(AutomationAction);

@Schema({ collection: 'automations', ...baseSchemaOptions })
export class Automation {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: String, enum: AUTOMATION_LOCATION_TYPES, required: true })
  locationType: AutomationLocationType;

  @Prop({ type: Types.ObjectId, required: true })
  locationId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: Boolean, default: true })
  active: boolean;

  @Prop({ type: AutomationTriggerSchema, required: true })
  trigger: AutomationTrigger;

  @Prop({ type: [AutomationConditionSchema], default: [] })
  conditions: AutomationCondition[];

  @Prop({ type: [AutomationActionSchema], default: [] })
  actions: AutomationAction[];

  /** sha256 of the hook secret; the plain value is shown once, on creation. */
  @ApiHideProperty()
  @Prop({ type: String, default: null, select: false })
  secretHash: string | null;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;
}

export type AutomationDocument = HydratedDocument<Automation>;

export const AutomationSchema = SchemaFactory.createForClass(Automation);

AutomationSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    const plain = ret as unknown as Record<string, unknown>;
    plain.id = String(plain._id);
    delete plain._id;
    delete plain.__v;
    delete plain.secretHash;
    return plain;
  },
});

AutomationSchema.index({ workspaceId: 1, locationType: 1, locationId: 1, _id: -1 });
AutomationSchema.index({ workspaceId: 1, active: 1, 'trigger.type': 1 });
