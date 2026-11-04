import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import { AUDIT_ENTITY_TYPES, AuditEntityType } from '../audit-fields';

/** Trail of the admin actions of a workspace. Written once, never updated. */
@Schema({ collection: 'audit_logs', ...baseSchemaOptions })
export class AuditLog {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  actorId: Types.ObjectId | null;

  @Prop({ required: true })
  action: string;

  @Prop({ type: String, enum: AUDIT_ENTITY_TYPES, required: true })
  entityType: AuditEntityType;

  @Prop({ type: Types.ObjectId, default: null })
  entityId: Types.ObjectId | null;

  /** Request snapshot with every secret already redacted. */
  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  details: Record<string, unknown>;

  @Prop({ default: '' })
  ip: string;

  @Prop({ default: '' })
  userAgent: string;
}

export type AuditLogDocument = HydratedDocument<AuditLog>;

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

AuditLogSchema.index({ workspaceId: 1, _id: -1 });
AuditLogSchema.index({ workspaceId: 1, action: 1, _id: -1 });
AuditLogSchema.index({ workspaceId: 1, actorId: 1, _id: -1 });
