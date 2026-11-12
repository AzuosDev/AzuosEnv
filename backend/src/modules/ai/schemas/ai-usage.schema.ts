import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import { AI_FEATURES, AiFeature } from '../ai-fields';

/** One call to the model, the unit the monthly budget of the workspace is read from. */
@Schema({ collection: 'ai_usage', ...baseSchemaOptions })
export class AiUsageEntry {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  /** Null on a run of a scheduled agent, which has no requester. */
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  userId: Types.ObjectId | null;

  @Prop({ type: String, enum: AI_FEATURES, required: true })
  feature: AiFeature;

  @Prop({ type: Number, default: 0 })
  tokensIn: number;

  @Prop({ type: Number, default: 0 })
  tokensOut: number;

  @Prop({ type: String, default: '' })
  model: string;
}

export type AiUsageEntryDocument = HydratedDocument<AiUsageEntry>;

export const AiUsageEntrySchema = SchemaFactory.createForClass(AiUsageEntry);

AiUsageEntrySchema.index({ workspaceId: 1, createdAt: -1 });
AiUsageEntrySchema.index({ workspaceId: 1, userId: 1, createdAt: -1 });
