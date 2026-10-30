import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CursorPage, buildCursorPage, decodeObjectIdCursor } from '../../common/pagination/cursor';
import {
  DEFAULT_PAGE_SIZE,
  PaginationQueryDto,
} from '../../common/pagination/pagination-query.dto';
import { WorkspaceMember, WorkspaceMemberDocument } from './schemas/workspace-member.schema';
import { RequestMembership } from './workspace-context';
import { AssignableRole } from './workspace-roles';

const MEMBER_USER_FIELDS = 'name email avatarUrl timezone';

@Injectable()
export class MembersService {
  constructor(@InjectModel(WorkspaceMember.name) private readonly model: Model<WorkspaceMember>) {}

  async list(
    workspaceId: Types.ObjectId,
    query: PaginationQueryDto,
  ): Promise<CursorPage<WorkspaceMemberDocument>> {
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const filter = query.cursor
      ? { workspaceId, _id: { $gt: decodeObjectIdCursor(query.cursor) } }
      : { workspaceId };

    const docs = await this.model
      .find(filter)
      .sort({ _id: 1 })
      .limit(limit + 1)
      .populate('userId', MEMBER_USER_FIELDS)
      .exec();

    return buildCursorPage(docs, limit, (doc) => ({ id: String(doc._id) }));
  }

  /** The owner role is only changed through transfer-ownership. */
  async updateRole(
    workspaceId: Types.ObjectId,
    memberId: Types.ObjectId,
    actor: RequestMembership,
    role: AssignableRole,
  ): Promise<WorkspaceMemberDocument> {
    const member = await this.require(workspaceId, memberId);

    if (member.role === 'owner') {
      throw new ForbiddenException({
        code: 'OWNER_ROLE_IMMUTABLE',
        message: 'Use a transferência de posse para alterar o proprietário.',
      });
    }

    if (String(member._id) === actor.id) {
      throw new ForbiddenException({
        code: 'CANNOT_CHANGE_OWN_ROLE',
        message: 'Você não pode alterar o seu próprio papel.',
      });
    }

    member.role = role;

    return member.save();
  }

  async deactivate(
    workspaceId: Types.ObjectId,
    memberId: Types.ObjectId,
    actor: RequestMembership,
  ): Promise<WorkspaceMemberDocument> {
    const member = await this.require(workspaceId, memberId);

    if (member.role === 'owner') {
      throw new ForbiddenException({
        code: 'CANNOT_DEACTIVATE_OWNER',
        message: 'O proprietário não pode ser desativado.',
      });
    }

    if (String(member._id) === actor.id) {
      throw new ForbiddenException({
        code: 'CANNOT_DEACTIVATE_SELF',
        message: 'Você não pode desativar o seu próprio acesso.',
      });
    }

    member.status = 'deactivated';

    return member.save();
  }

  /** Active members among the given users; used to validate team composition. */
  async activeUserIds(
    workspaceId: Types.ObjectId,
    userIds: Types.ObjectId[],
  ): Promise<Types.ObjectId[]> {
    const members = await this.model
      .find({ workspaceId, userId: { $in: userIds }, status: 'active' })
      .select('userId')
      .exec();

    return members.map((member) => member.userId);
  }

  /** Every active member of the workspace; used by the global search. */
  async activeUserIdsOf(workspaceId: Types.ObjectId): Promise<Types.ObjectId[]> {
    const members = await this.model
      .find({ workspaceId, status: 'active' })
      .select('userId')
      .exec();

    return members.map((member) => member.userId);
  }

  private async require(
    workspaceId: Types.ObjectId,
    memberId: Types.ObjectId,
  ): Promise<WorkspaceMemberDocument> {
    const member = await this.model.findOne({ _id: memberId, workspaceId }).exec();

    if (!member) {
      throw new NotFoundException({
        code: 'MEMBER_NOT_FOUND',
        message: 'Membro não encontrado neste workspace.',
      });
    }

    return member;
  }
}
