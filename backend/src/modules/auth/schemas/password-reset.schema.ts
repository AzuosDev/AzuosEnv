import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';

@Schema({ collection: 'password_resets', ...baseSchemaOptions })
export class PasswordReset {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, unique: true })
  tokenHash: string;

  /** TTL index: Mongo drops the document once the 30 minutes are over. */
  @Prop({ required: true, expires: 0 })
  expiresAt: Date;

  /** Set when the token is spent and when a newer request invalidates it. */
  @Prop()
  usedAt?: Date;

  @Prop()
  ip?: string;
}

export type PasswordResetDocument = HydratedDocument<PasswordReset>;

export const PasswordResetSchema = SchemaFactory.createForClass(PasswordReset);
