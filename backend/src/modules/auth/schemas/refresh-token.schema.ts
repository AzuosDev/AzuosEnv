import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';

@Schema({ collection: 'refresh_tokens', ...baseSchemaOptions })
export class RefreshToken {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, index: true })
  familyId: string;

  @Prop({ required: true, unique: true })
  tokenHash: string;

  @Prop({ required: true, expires: 0 })
  expiresAt: Date;

  @Prop()
  revokedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'RefreshToken' })
  replacedById?: Types.ObjectId;

  @Prop()
  userAgent?: string;

  @Prop()
  ip?: string;
}

export type RefreshTokenDocument = HydratedDocument<RefreshToken>;

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);
