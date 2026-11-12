import { Types } from 'mongoose';
import { WorkspaceRole } from './workspace-roles';

export const MEMBER_INVITED = 'workspace.member-invited';

/** Emitted only when the invited e-mail already has an account to notify. */
export interface MemberInvitedEvent {
  workspaceId: Types.ObjectId;
  workspaceName: string;
  userId: Types.ObjectId;
  email: string;
  role: WorkspaceRole;
  actorId: Types.ObjectId;
  acceptUrl: string;
}
