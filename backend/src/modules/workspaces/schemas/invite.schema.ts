import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import { ASSIGNABLE_ROLES, AssignableRole } from '../workspace-roles';

export const INVITE_TTL_DAYS = 7;
export const INVITE_TTL_MS = INVITE_TTL_DAYS * 24 * 60 * 60 * 1000;

@Schema({ collection: 'invites', ...baseSchemaOptions })
export class Invite {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  @Prop({ type: String, enum: ASSIGNABLE_ROLES, required: true })
  role: AssignableRole;

  @Prop({ required: true, unique: true })
  tokenHash: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop()
  acceptedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  invitedBy?: Types.ObjectId;
}

export type InviteDocument = HydratedDocument<Invite>;

export const InviteSchema = SchemaFactory.createForClass(Invite);

InviteSchema.index({ workspaceId: 1, email: 1 });

InviteSchema.set('toJSON', {
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
