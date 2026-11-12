import { Request } from 'express';
import { Types } from 'mongoose';
import { WorkspaceMemberDocument, WorkspaceMemberStatus } from './schemas/workspace-member.schema';
import { WorkspaceDocument } from './schemas/workspace.schema';
import { WorkspaceRole } from './workspace-roles';

/** Membership attached to the request by the WorkspaceGuard. */
export interface RequestMembership {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  status: WorkspaceMemberStatus;
}

export interface WorkspaceRequest extends Request {
  workspace?: WorkspaceDocument;
  membership?: RequestMembership;
}

export function toRequestMembership(member: WorkspaceMemberDocument): RequestMembership {
  return {
    id: String(member._id),
    workspaceId: String(member.workspaceId),
    userId: String(member.userId),
    role: member.role,
    status: member.status,
  };
}

export function workspaceObjectId(membership: RequestMembership): Types.ObjectId {
  return new Types.ObjectId(membership.workspaceId);
}
