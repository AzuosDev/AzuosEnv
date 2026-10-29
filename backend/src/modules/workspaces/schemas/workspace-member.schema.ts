import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import { WORKSPACE_ROLES, WorkspaceRole } from '../workspace-roles';

export const MEMBER_STATUSES = ['active', 'invited', 'deactivated'] as const;
export type WorkspaceMemberStatus = (typeof MEMBER_STATUSES)[number];

export const DEFAULT_CAPACITY_PER_DAY = 8;

@Schema({ collection: 'workspace_members', ...baseSchemaOptions })
export class WorkspaceMember {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: WORKSPACE_ROLES, required: true })
  role: WorkspaceRole;

  @Prop({ type: String, enum: MEMBER_STATUSES, default: 'active' })
  status: WorkspaceMemberStatus;

  @Prop({ default: DEFAULT_CAPACITY_PER_DAY })
  capacityPerDay: number;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  invitedBy?: Types.ObjectId;

  @Prop()
  joinedAt?: Date;
}

export type WorkspaceMemberDocument = HydratedDocument<WorkspaceMember>;

export const WorkspaceMemberSchema = SchemaFactory.createForClass(WorkspaceMember);

WorkspaceMemberSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });
WorkspaceMemberSchema.index({ userId: 1, status: 1 });
