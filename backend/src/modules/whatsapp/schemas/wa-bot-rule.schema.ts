import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import {
  WA_BOT_ACTION_KINDS,
  WA_BOT_REPLY_KINDS,
  WA_BOT_TRIGGERS,
  WA_PRIORITIES,
  WaBotActionKind,
  WaBotReplyKind,
  WaBotTrigger,
  WaPriority,
} from '../whatsapp-fields';
import { WaMenuOption, WaMenuOptionSchema } from './wa-bot-settings.schema';

/** What makes the rule fire; `value` is the keyword, the regex or the option id. */
@Schema({ _id: false })
export class WaBotRuleTrigger {
  @Prop({ type: String, enum: WA_BOT_TRIGGERS, required: true })
  kind: WaBotTrigger;

  @Prop({ type: String, default: '' })
  value: string;
}

export const WaBotRuleTriggerSchema = SchemaFactory.createForClass(WaBotRuleTrigger);

/** Answer the rule sends back. */
@Schema({ _id: false })
export class WaBotRuleReply {
  @Prop({ type: String, enum: WA_BOT_REPLY_KINDS, default: 'text' })
  kind: WaBotReplyKind;

  /** Body of the message; accepts the variables of `renderWaText`. */
  @Prop({ type: String, default: '' })
  text: string;

  /** Public link of the file on a `media` reply; Meta fetches it. */
  @Prop({ type: String, default: '' })
  mediaUrl: string;

  @Prop({ type: String, default: '' })
  mediaMime: string;

  @Prop({ type: String, default: '' })
  filename: string;

  @Prop({ type: String, default: '' })
  header: string;

  @Prop({ type: String, default: '' })
  footer: string;

  @Prop({ type: String, default: 'Ver opções' })
  buttonLabel: string;

  @Prop({ type: [WaMenuOptionSchema], default: [] })
  options: WaMenuOption[];
}

export const WaBotRuleReplySchema = SchemaFactory.createForClass(WaBotRuleReply);

/** Side effect the rule applies to the conversation. */
@Schema({ _id: false })
export class WaBotRuleAction {
  @Prop({ type: String, enum: WA_BOT_ACTION_KINDS, required: true })
  kind: WaBotActionKind;

  /** Member the conversation goes to on `assign`. */
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  userId: Types.ObjectId | null;

  /** Tag written on the contact by `tag`. */
  @Prop({ type: String, default: '' })
  tag: string;

  @Prop({ type: String, enum: WA_PRIORITIES, default: 'high' })
  priority: WaPriority;

  /** List the lead of `createLead` lands in; empty uses Comercial › Leads. */
  @Prop({ type: Types.ObjectId, ref: 'List', default: null })
  listId: Types.ObjectId | null;
}

export const WaBotRuleActionSchema = SchemaFactory.createForClass(WaBotRuleAction);

/** One rule of the bot: a trigger, an answer and the actions that follow. */
@Schema({ collection: 'wa_bot_rules', ...baseSchemaOptions })
export class WaBotRule {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: WaBotRuleTriggerSchema, required: true })
  trigger: WaBotRuleTrigger;

  @Prop({ type: WaBotRuleReplySchema, default: () => ({}) })
  reply: WaBotRuleReply;

  @Prop({ type: [WaBotRuleActionSchema], default: [] })
  actions: WaBotRuleAction[];

  /** Higher wins; ties are broken by the oldest rule. */
  @Prop({ type: Number, default: 0 })
  priority: number;

  @Prop({ type: Boolean, default: true })
  active: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;
}

export type WaBotRuleDocument = HydratedDocument<WaBotRule>;

export const WaBotRuleSchema = SchemaFactory.createForClass(WaBotRule);

WaBotRuleSchema.index({ workspaceId: 1, active: 1, priority: -1 });
