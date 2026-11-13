import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PermissionContext } from '../hierarchy/permission.service';
import { WorkspaceMember } from '../workspaces/schemas/workspace-member.schema';
import { WorkspaceRole, hasRoleAtLeast } from '../workspaces/workspace-roles';
import { WaAccess, WaAccessDocument } from './schemas/wa-access.schema';
import { WaAccessLevel, hasWaLevelAtLeast, waLevelRank } from './whatsapp-fields';

/** One line of `GET /whatsapp/access`: the member and the level they ended up with. */
export interface WaAccessEntry {
  userId: string;
  role: WorkspaceRole;
  level: WaAccessLevel | null;
  /** True when the level comes from the role (owner and admin are always gestor). */
  fromRole: boolean;
}

/**
 * Permission of the whatsapp module. Owner and admin are gestor by the role; every
 * other member starts with no access and only sees the module after an explicit
 * grant. No access answers 404 everywhere, so the module stays invisible.
 */
@Injectable()
export class WhatsappAccessService {
  constructor(
    @InjectModel(WaAccess.name) private readonly model: Model<WaAccess>,
    @InjectModel(WorkspaceMember.name) private readonly members: Model<WorkspaceMember>,
  ) {}

  notFound(): NotFoundException {
    return new NotFoundException({
      code: 'WHATSAPP_NOT_FOUND',
      message: 'Módulo do WhatsApp não encontrado.',
    });
  }

  /** Effective level of the requester, or null when they have no access. */
  async levelOf(ctx: PermissionContext): Promise<WaAccessLevel | null> {
    if (hasRoleAtLeast(ctx.role, 'admin')) {
      return 'gestor';
    }

    const row = await this.model
      .findOne({ workspaceId: ctx.workspaceId, userId: ctx.userId })
      .exec();

    return row?.level ?? null;
  }

  /** Level of the requester, enforcing `required`; no access at all is a 404. */
  async require(ctx: PermissionContext, required: WaAccessLevel): Promise<WaAccessLevel> {
    const level = await this.levelOf(ctx);

    if (level === null) {
      throw this.notFound();
    }

    if (!hasWaLevelAtLeast(level, required)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_WHATSAPP',
        message: 'Seu nível no WhatsApp não permite esta ação.',
      });
    }

    return level;
  }

  /** Active members of the workspace and the level each one has. */
  async list(ctx: PermissionContext): Promise<WaAccessEntry[]> {
    const members = await this.members
      .find({ workspaceId: ctx.workspaceId, status: 'active' })
      .sort({ _id: 1 })
      .exec();
    const granted = await this.model.find({ workspaceId: ctx.workspaceId }).exec();
    const byUser = new Map(granted.map((row) => [String(row.userId), row.level]));

    return members.map((member) => {
      const fromRole = hasRoleAtLeast(member.role, 'admin');

      return {
        userId: String(member.userId),
        role: member.role,
        level: fromRole ? 'gestor' : (byUser.get(String(member.userId)) ?? null),
        fromRole,
      };
    });
  }

  /** Grants or changes the level of a member. */
  async grant(
    ctx: PermissionContext,
    userId: Types.ObjectId,
    level: WaAccessLevel,
  ): Promise<WaAccessDocument> {
    await this.requireMember(ctx, userId);

    const row = await this.model
      .findOneAndUpdate(
        { workspaceId: ctx.workspaceId, userId },
        { $set: { level, grantedBy: ctx.userId } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();

    if (!row) {
      throw this.notFound();
    }

    return row;
  }

  async revoke(ctx: PermissionContext, userId: Types.ObjectId): Promise<void> {
    await this.requireMember(ctx, userId);
    await this.model.deleteOne({ workspaceId: ctx.workspaceId, userId }).exec();
  }

  /** Active members whose level is at least `required`; used by the notifications. */
  async userIdsAtLeast(
    workspaceId: Types.ObjectId,
    required: WaAccessLevel,
  ): Promise<Types.ObjectId[]> {
    const members = await this.members.find({ workspaceId, status: 'active' }).exec();
    const granted = await this.model.find({ workspaceId }).exec();
    const byUser = new Map(granted.map((row) => [String(row.userId), row.level]));
    const wanted = waLevelRank(required);

    return members
      .filter((member) => {
        const level = hasRoleAtLeast(member.role, 'admin')
          ? 'gestor'
          : byUser.get(String(member.userId));

        return level !== undefined && waLevelRank(level) >= wanted;
      })
      .map((member) => member.userId);
  }

  private async requireMember(ctx: PermissionContext, userId: Types.ObjectId): Promise<void> {
    const member = await this.members
      .findOne({ workspaceId: ctx.workspaceId, userId, status: { $ne: 'deactivated' } })
      .exec();

    if (!member) {
      throw new NotFoundException({
        code: 'MEMBER_NOT_FOUND',
        message: 'Membro não encontrado no workspace.',
      });
    }
  }
}
