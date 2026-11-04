import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../../common/schemas/base-schema-options';
import { DEFAULT_DEPLOY_STATUS, DEFAULT_REVIEW_STATUS } from '../github-fields';

/**
 * Mapping repository -> workspace. The secret has to be read back to verify the
 * signature of GitHub, so it is stored encrypted instead of hashed.
 */
@Schema({ collection: 'github_integrations', ...baseSchemaOptions })
export class GithubIntegration {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  /** `owner/name`, always lowercase: one repository belongs to one workspace. */
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  repository: string;

  /** Encrypted by the SecretsService; shown in plain only when it is generated. */
  @Prop({ required: true, select: false })
  secret: string;

  @Prop({ type: String, default: DEFAULT_REVIEW_STATUS })
  reviewStatusName: string;

  @Prop({ type: String, default: DEFAULT_DEPLOY_STATUS })
  deployStatusName: string;

  @Prop({ type: Boolean, default: true })
  active: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Date, default: null })
  lastEventAt: Date | null;
}

export type GithubIntegrationDocument = HydratedDocument<GithubIntegration>;

export const GithubIntegrationSchema = SchemaFactory.createForClass(GithubIntegration);

GithubIntegrationSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    const plain = ret as unknown as Record<string, unknown>;
    plain.id = String(plain._id);
    delete plain._id;
    delete plain.__v;
    delete plain.secret;

    return plain;
  },
});

GithubIntegrationSchema.index({ workspaceId: 1, _id: -1 });
