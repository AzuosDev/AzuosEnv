import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import { ClickAppKey } from '../../workspaces/schemas/workspace.schema';

export const DEFAULT_SPACE_COLOR = '#2563EB';

/** Partial override of the workspace ClickApps; absent keys follow the workspace. */
export type ClickAppsOverride = Partial<Record<ClickAppKey, boolean>>;

@Schema({ collection: 'spaces', ...baseSchemaOptions })
export class Space {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ default: DEFAULT_SPACE_COLOR })
  color: string;

  @Prop()
  icon?: string;

  @Prop({ default: false })
  private: boolean;

  @Prop({ type: Types.ObjectId, ref: 'StatusSet', required: true })
  statusSetId: Types.ObjectId;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'boolean' },
    description: 'ClickApps ligados ou desligados só neste Space.',
  })
  @Prop({ type: Object })
  clickApps?: ClickAppsOverride;

  @Prop({ required: true })
  position: string;

  @Prop({ type: Date, default: null })
  archivedAt: Date | null;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export type SpaceDocument = HydratedDocument<Space>;

export const SpaceSchema = SchemaFactory.createForClass(Space);

SpaceSchema.index({ workspaceId: 1, deletedAt: 1, position: 1 });
