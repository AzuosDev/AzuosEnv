import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import { AI_AGENT_TYPES, AiAgentType } from '../ai-fields';

/**
 * Scheduled agent of the workspace. `config` says where the digest lands: a channel
 * (`channelId`) or the Inbox of `userIds` (the creator, when nothing is set).
 */
@Schema({ collection: 'ai_agents', ...baseSchemaOptions })
export class AiAgent {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true })
  name: string;

  @Prop({ type: String, enum: AI_AGENT_TYPES, required: true })
  type: AiAgentType;

  @Prop({ type: String, required: true, trim: true })
  cron: string;

  @Prop({ type: Object, default: {} })
  config: Record<string, unknown>;

  @Prop({ type: Boolean, default: true })
  active: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Date, default: null })
  lastRunAt: Date | null;
}

export type AiAgentDocument = HydratedDocument<AiAgent>;

export const AiAgentSchema = SchemaFactory.createForClass(AiAgent);

AiAgentSchema.index({ workspaceId: 1, _id: -1 });
AiAgentSchema.index({ workspaceId: 1, active: 1, type: 1 });
