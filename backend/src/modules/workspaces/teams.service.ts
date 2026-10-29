import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CursorPage, buildCursorPage, decodeObjectIdCursor } from '../../common/pagination/cursor';
import {
  DEFAULT_PAGE_SIZE,
  PaginationQueryDto,
} from '../../common/pagination/pagination-query.dto';
import { MembersService } from './members.service';
import { CreateTeamDto, UpdateTeamDto } from './dto/team.dto';
import { Team, TeamDocument } from './schemas/team.schema';

@Injectable()
export class TeamsService {
  constructor(
    @InjectModel(Team.name) private readonly model: Model<Team>,
    private readonly members: MembersService,
  ) {}

  async create(workspaceId: Types.ObjectId, dto: CreateTeamDto): Promise<TeamDocument> {
    return this.model.create({
      workspaceId,
      name: dto.name,
      memberIds: await this.resolveMemberIds(workspaceId, dto.memberIds),
    });
  }

  async list(
    workspaceId: Types.ObjectId,
    query: PaginationQueryDto,
  ): Promise<CursorPage<TeamDocument>> {
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const filter = query.cursor
      ? { workspaceId, _id: { $gt: decodeObjectIdCursor(query.cursor) } }
      : { workspaceId };

    const docs = await this.model
      .find(filter)
      .sort({ _id: 1 })
      .limit(limit + 1)
      .exec();

    return buildCursorPage(docs, limit, (doc) => ({ id: String(doc._id) }));
  }

  async update(
    workspaceId: Types.ObjectId,
    teamId: Types.ObjectId,
    dto: UpdateTeamDto,
  ): Promise<TeamDocument> {
    const team = await this.require(workspaceId, teamId);

    if (dto.name !== undefined) {
      team.name = dto.name;
    }

    if (dto.memberIds !== undefined) {
      team.memberIds = await this.resolveMemberIds(workspaceId, dto.memberIds);
    }

    return team.save();
  }

  async remove(workspaceId: Types.ObjectId, teamId: Types.ObjectId): Promise<void> {
    const team = await this.require(workspaceId, teamId);

    await team.deleteOne();
  }

  /** Every member of a team must be an active member of the workspace. */
  private async resolveMemberIds(
    workspaceId: Types.ObjectId,
    memberIds: string[] | undefined,
  ): Promise<Types.ObjectId[]> {
    if (!memberIds || memberIds.length === 0) {
      return [];
    }

    const requested = [...new Set(memberIds)].map((id) => new Types.ObjectId(id));
    const allowed = await this.members.activeUserIds(workspaceId, requested);

    if (allowed.length !== requested.length) {
      throw new BadRequestException({
        code: 'INVALID_TEAM_MEMBERS',
        message: 'Todos os integrantes devem ser membros ativos do workspace.',
      });
    }

    return allowed;
  }

  private async require(
    workspaceId: Types.ObjectId,
    teamId: Types.ObjectId,
  ): Promise<TeamDocument> {
    const team = await this.model.findOne({ _id: teamId, workspaceId }).exec();

    if (!team) {
      throw new NotFoundException({ code: 'TEAM_NOT_FOUND', message: 'Equipe não encontrada.' });
    }

    return team;
  }
}
