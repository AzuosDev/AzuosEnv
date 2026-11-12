import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiHideProperty } from '@nestjs/swagger';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import { API_KEY_SCOPES, ApiKeyScope } from '../api-key-fields';

/**
 * Personal key accepted in place of the JWT on the same routes. Only the sha256 of
 * the token is stored; the plain value is shown once, when the key is created.
 */
@Schema({ collection: 'api_keys', ...baseSchemaOptions })
export class ApiKey {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  /** `azk_` plus the first characters of the token, to identify it in the listing. */
  @Prop({ required: true })
  hint: string;

  @ApiHideProperty()
  @Prop({ required: true, unique: true, select: false })
  tokenHash: string;

  @Prop({ type: [String], enum: API_KEY_SCOPES, default: ['read'] })
  scopes: ApiKeyScope[];

  @Prop({ type: Date, default: null })
  expiresAt: Date | null;

  @Prop({ type: Date, default: null })
  lastUsedAt: Date | null;

  @Prop({ type: Date, default: null })
  revokedAt: Date | null;
}

export type ApiKeyDocument = HydratedDocument<ApiKey>;

export const ApiKeySchema = SchemaFactory.createForClass(ApiKey);

ApiKeySchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    const plain = ret as unknown as Record<string, unknown>;
    plain.id = String(plain._id);
    delete plain._id;
    delete plain.__v;
    delete plain.tokenHash;

    return plain;
  },
});

ApiKeySchema.index({ userId: 1, _id: -1 });
