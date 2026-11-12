import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TeamsService } from '../workspaces/teams.service';
import { RequestMembership } from '../workspaces/workspace-context';
import { WorkspaceRole, hasRoleAtLeast } from '../workspaces/workspace-roles';
import {
  PermissionLevel,
  PermissionResourceType,
  hasLevelAtLeast,
  maxLevel,
} from './permission-levels';
import { Permission, PermissionDocument } from './schemas/permission.schema';

/** Who is asking; `teamIds` is resolved once per request and cached here. */
export interface PermissionContext {
  workspaceId: Types.ObjectId;
  userId: Types.ObjectId;
  role: WorkspaceRole;
  teamIds?: Types.ObjectId[];
}

/** One node of the inheritance chain (space -> folder -> list -> task). */
export interface ResourceRef {
  resourceType: PermissionResourceType;
  resourceId: Types.ObjectId;
  private?: boolean;
}

/** Explicit permissions of the requester, keyed by `resourceType:resourceId`. */
export type ExplicitLevels = Map<string, PermissionLevel>;

export function permissionContextFrom(membership: RequestMembership): PermissionContext {
  return {
    workspaceId: new Types.ObjectId(membership.workspaceId),
    userId: new Types.ObjectId(membership.userId),
    role: membership.role,
  };
}

export function permissionKey(resourceType: PermissionResourceType, resourceId: unknown): string {
  return `${resourceType}:${String(resourceId)}`;
}

@Injectable()
export class PermissionService {
  constructor(
    @InjectModel(Permission.name) private readonly model: Model<Permission>,
    private readonly teams: TeamsService,
  ) {}

  /**
   * Effective level of the requester over the resource at the end of `chain`.
   * Admins and the owner always get `full`; a member gets `full` while no node of
   * the chain is private; guest and limited only get what was shared explicitly.
   */
  async levelFor(ctx: PermissionContext, chain: ResourceRef[]): Promise<PermissionLevel | null> {
    if (hasRoleAtLeast(ctx.role, 'admin')) {
      return 'full';
    }

    return this.levelFromChain(ctx, chain, await this.explicitLevels(ctx));
  }

  /** Same resolution as `levelFor`, reusing a map loaded once for many nodes. */
  levelFromChain(
    ctx: PermissionContext,
    chain: ResourceRef[],
    explicit: ExplicitLevels,
  ): PermissionLevel | null {
    if (hasRoleAtLeast(ctx.role, 'admin')) {
      return 'full';
    }

    const granted = chain.reduce<PermissionLevel | null>(
      (level, node) =>
        maxLevel(level, explicit.get(permissionKey(node.resourceType, node.resourceId)) ?? null),
      null,
    );

    if (ctx.role === 'member') {
      const isPrivate = chain.some((node) => node.private === true);

      return maxLevel(granted, isPrivate ? null : 'full');
    }

    return granted;
  }

  /** Every permission of the requester (as user or through a team) in the workspace. */
  async explicitLevels(ctx: PermissionContext): Promise<ExplicitLevels> {
    const principalIds = [ctx.userId, ...(await this.teamIds(ctx))];
    // Projection and lean: only the level of the chain is read, never saved back.
    const docs = await this.model
      .find({ workspaceId: ctx.workspaceId, principalId: { $in: principalIds } })
      .select('resourceType resourceId level')
      .lean()
      .exec();

    const levels: ExplicitLevels = new Map();

    for (const doc of docs) {
      const key = permissionKey(doc.resourceType, doc.resourceId);
      const merged = maxLevel(levels.get(key) ?? null, doc.level);

      if (merged) {
        levels.set(key, merged);
      }
    }

    return levels;
  }

  canView(level: PermissionLevel | null): boolean {
    return hasLevelAtLeast(level, 'view');
  }

  canComment(level: PermissionLevel | null): boolean {
    return hasLevelAtLeast(level, 'comment');
  }

  canEdit(level: PermissionLevel | null): boolean {
    return hasLevelAtLeast(level, 'edit');
  }

  canManage(level: PermissionLevel | null): boolean {
    return hasLevelAtLeast(level, 'full');
  }

  /** A resource the requester cannot even see must look like it does not exist. */
  assertLevel(
    level: PermissionLevel | null,
    required: PermissionLevel,
    notFound: () => Error,
  ): void {
    if (hasLevelAtLeast(level, required)) {
      return;
    }

    if (!this.canView(level)) {
      throw notFound();
    }

    throw new ForbiddenException({
      code: 'FORBIDDEN_RESOURCE',
      message: 'Você não tem permissão para esta ação.',
    });
  }

  findById(
    workspaceId: Types.ObjectId,
    permissionId: Types.ObjectId,
  ): Promise<PermissionDocument | null> {
    return this.model.findOne({ _id: permissionId, workspaceId }).exec();
  }

  listForResource(
    workspaceId: Types.ObjectId,
    resourceType: PermissionResourceType,
    resourceId: Types.ObjectId,
  ): Promise<PermissionDocument[]> {
    return this.model.find({ workspaceId, resourceType, resourceId }).sort({ _id: 1 }).exec();
  }

  /** Shares a resource; re-sharing the same principal updates the level. */
  async share(
    workspaceId: Types.ObjectId,
    input: {
      resourceType: PermissionResourceType;
      resourceId: Types.ObjectId;
      principalType: 'user' | 'team';
      principalId: Types.ObjectId;
      level: PermissionLevel;
      createdBy: Types.ObjectId;
    },
  ): Promise<PermissionDocument> {
    const doc = await this.model
      .findOneAndUpdate(
        {
          workspaceId,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          principalType: input.principalType,
          principalId: input.principalId,
        },
        { $set: { level: input.level }, $setOnInsert: { createdBy: input.createdBy } },
        { returnDocument: 'after', upsert: true },
      )
      .exec();

    return doc;
  }

  async unshare(workspaceId: Types.ObjectId, permissionId: Types.ObjectId): Promise<boolean> {
    const result = await this.model.deleteOne({ _id: permissionId, workspaceId }).exec();

    return result.deletedCount > 0;
  }

  /** Drops every permission of the resources, used when they are hard-deleted. */
  async removeForResources(
    workspaceId: Types.ObjectId,
    resourceType: PermissionResourceType,
    resourceIds: Types.ObjectId[],
  ): Promise<void> {
    if (resourceIds.length === 0) {
      return;
    }

    await this.model
      .deleteMany({ workspaceId, resourceType, resourceId: { $in: resourceIds } })
      .exec();
  }

  private async teamIds(ctx: PermissionContext): Promise<Types.ObjectId[]> {
    ctx.teamIds ??= await this.teams.teamIdsForUser(ctx.workspaceId, ctx.userId);

    return ctx.teamIds;
  }
}
