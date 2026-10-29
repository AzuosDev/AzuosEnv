import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';

export const DEFAULT_WORKSPACE_COLOR = '#2563EB';
export const DEFAULT_WORKSPACE_TIMEZONE = 'America/Fortaleza';

@Schema({ _id: false })
export class WorkspaceClickApps {
  @Prop({ default: true })
  priority: boolean;

  @Prop({ default: true })
  tags: boolean;

  @Prop({ default: true })
  timeTracking: boolean;

  @Prop({ default: true })
  estimates: boolean;

  @Prop({ default: true })
  sprints: boolean;

  @Prop({ default: true })
  customFields: boolean;

  @Prop({ default: true })
  multipleLists: boolean;

  @Prop({ default: true })
  customIds: boolean;

  @Prop({ default: true })
  ai: boolean;
}

export const WorkspaceClickAppsSchema = SchemaFactory.createForClass(WorkspaceClickApps);

@Schema({ _id: false })
export class WorkspaceSettings {
  @Prop({ type: WorkspaceClickAppsSchema, default: () => ({}) })
  clickApps: WorkspaceClickApps;
}

export const WorkspaceSettingsSchema = SchemaFactory.createForClass(WorkspaceSettings);

@Schema({ collection: 'workspaces', ...baseSchemaOptions })
export class Workspace {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  slug: string;

  @Prop()
  logoUrl?: string;

  @Prop({ default: DEFAULT_WORKSPACE_COLOR })
  color: string;

  @Prop({ required: true, uppercase: true, trim: true })
  taskPrefix: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  ownerId: Types.ObjectId;

  @Prop({ default: DEFAULT_WORKSPACE_TIMEZONE })
  timezone: string;

  @Prop({ type: WorkspaceSettingsSchema, default: () => ({}) })
  settings: WorkspaceSettings;

  @Prop()
  deletedAt?: Date;
}

export type WorkspaceDocument = HydratedDocument<Workspace>;

export const WorkspaceSchema = SchemaFactory.createForClass(Workspace);
