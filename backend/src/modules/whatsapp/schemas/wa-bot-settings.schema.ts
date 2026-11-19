import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import {
  DEFAULT_WA_AI_ANSWER_CHARS,
  DEFAULT_WA_BOT_PAUSE_MINUTES,
  WA_MENU_KINDS,
  WaMenuKind,
} from '../whatsapp-fields';

/** One button or one row of the interactive menu. */
@Schema({ _id: false })
export class WaMenuOption {
  /** Matched against the id of the button or row the contact tapped. */
  @Prop({ required: true, trim: true })
  id: string;

  @Prop({ required: true, trim: true })
  title: string;

  /** Only a list row shows it. */
  @Prop({ type: String, default: '' })
  description: string;
}

export const WaMenuOptionSchema = SchemaFactory.createForClass(WaMenuOption);

/** Menu the bot offers, as buttons or as an interactive list. */
@Schema({ _id: false })
export class WaBotMenu {
  @Prop({ type: Boolean, default: false })
  enabled: boolean;

  @Prop({ type: String, enum: WA_MENU_KINDS, default: 'buttons' })
  kind: WaMenuKind;

  @Prop({ type: String, default: '' })
  header: string;

  @Prop({ type: String, default: '' })
  body: string;

  @Prop({ type: String, default: '' })
  footer: string;

  /** Label that opens the list; the Cloud API requires it on a list. */
  @Prop({ type: String, default: 'Ver opções' })
  buttonLabel: string;

  @Prop({ type: [WaMenuOptionSchema], default: [] })
  options: WaMenuOption[];
}

export const WaBotMenuSchema = SchemaFactory.createForClass(WaBotMenu);

/** Answer by the AI, grounded on a knowledge base the gestor writes. */
@Schema({ _id: false })
export class WaBotAi {
  @Prop({ type: Boolean, default: false })
  enabled: boolean;

  /** Everything the model may state; it never answers beyond this. */
  @Prop({ type: String, default: '' })
  knowledgeBase: string;

  @Prop({ type: Number, default: DEFAULT_WA_AI_ANSWER_CHARS })
  maxAnswerChars: number;
}

export const WaBotAiSchema = SchemaFactory.createForClass(WaBotAi);

/** `HH:mm`–`HH:mm` window of attendance. */
@Schema({ _id: false })
export class WaHoursRange {
  @Prop({ required: true, trim: true })
  start: string;

  @Prop({ required: true, trim: true })
  end: string;
}

export const WaHoursRangeSchema = SchemaFactory.createForClass(WaHoursRange);

@Schema({ _id: false })
export class WaHoursDay {
  /** 0 = Sunday. */
  @Prop({ type: Number, required: true, min: 0, max: 6 })
  weekday: number;

  @Prop({ type: [WaHoursRangeSchema], default: [] })
  ranges: WaHoursRange[];
}

export const WaHoursDaySchema = SchemaFactory.createForClass(WaHoursDay);

@Schema({ _id: false })
export class WaHoliday {
  /** `YYYY-MM-DD` in the zone of the attendance. */
  @Prop({ required: true, trim: true })
  date: string;

  @Prop({ type: String, default: '' })
  name: string;
}

export const WaHolidaySchema = SchemaFactory.createForClass(WaHoliday);

/** Days, windows and holidays of the attendance, plus what to say when closed. */
@Schema({ _id: false })
export class WaBotHours {
  @Prop({ type: Boolean, default: false })
  enabled: boolean;

  /** Empty uses the timezone of the workspace. */
  @Prop({ type: String, default: '' })
  timezone: string;

  @Prop({ type: [WaHoursDaySchema], default: [] })
  days: WaHoursDay[];

  @Prop({ type: [WaHolidaySchema], default: [] })
  holidays: WaHoliday[];

  @Prop({ type: String, default: '' })
  awayMessage: string;
}

export const WaBotHoursSchema = SchemaFactory.createForClass(WaBotHours);

/** Settings of the bot and of the attendance. One document per workspace. */
@Schema({ collection: 'wa_bot_settings', ...baseSchemaOptions })
export class WaBotSettings {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, unique: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: Boolean, default: false })
  enabled: boolean;

  @Prop({ type: String, default: '' })
  welcomeMessage: string;

  @Prop({ type: WaBotMenuSchema, default: () => ({}) })
  menu: WaBotMenu;

  @Prop({ type: String, default: '' })
  handoffMessage: string;

  /** Minutes the bot stays quiet after an attendant answers. */
  @Prop({ type: Number, default: DEFAULT_WA_BOT_PAUSE_MINUTES })
  pauseMinutes: number;

  /** Sent when an attendant finishes the conversation. */
  @Prop({ type: String, default: '' })
  closingMessage: string;

  @Prop({ type: WaBotAiSchema, default: () => ({}) })
  ai: WaBotAi;

  @Prop({ type: WaBotHoursSchema, default: () => ({}) })
  hours: WaBotHours;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  updatedBy: Types.ObjectId | null;
}

export type WaBotSettingsDocument = HydratedDocument<WaBotSettings>;

export const WaBotSettingsSchema = SchemaFactory.createForClass(WaBotSettings);
