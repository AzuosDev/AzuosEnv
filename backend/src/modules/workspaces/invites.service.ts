import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { randomBytes } from 'node:crypto';
import { Model, Types } from 'mongoose';
import { CursorPage, buildCursorPage, decodeObjectIdCursor } from '../../common/pagination/cursor';
import {
  DEFAULT_PAGE_SIZE,
  PaginationQueryDto,
} from '../../common/pagination/pagination-query.dto';
import { sha256Hex } from '../../common/utils/hash';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
import { AcceptInviteDto, CreateInviteDto } from './dto/invite.dto';
import { INVITE_TTL_MS, Invite, InviteDocument } from './schemas/invite.schema';
import { WorkspaceMember, WorkspaceMemberDocument } from './schemas/workspace-member.schema';
import { Workspace, WorkspaceDocument } from './schemas/workspace.schema';
import { RequestMembership } from './workspace-context';

export interface CreatedInvite {
  invite: InviteDocument;
  token: string;
  acceptUrl: string;
}

export interface AcceptedInvite {
  workspace: { id: string; name: string; slug: string };
  member: WorkspaceMemberDocument;
  accountCreated: boolean;
}

@Injectable()
export class InvitesService {
  constructor(
    @InjectModel(Invite.name) private readonly model: Model<Invite>,
    @InjectModel(WorkspaceMember.name) private readonly members: Model<WorkspaceMember>,
    @InjectModel(Workspace.name) private readonly workspaces: Model<Workspace>,
    private readonly usersService: UsersService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  /** Issues a token, stores only its hash and mails the invite link. */
  async create(
    workspace: WorkspaceDocument,
    actor: RequestMembership,
    dto: CreateInviteDto,
  ): Promise<CreatedInvite> {
    const invitedBy = new Types.ObjectId(actor.userId);
    const user = await this.usersService.findByEmail(dto.email);

    if (user) {
      const existing = await this.members
        .findOne({ workspaceId: workspace._id, userId: user._id })
        .exec();

      if (existing?.status === 'active') {
        throw new ConflictException({
          code: 'ALREADY_MEMBER',
          message: 'Esta pessoa já é membro do workspace.',
        });
      }
    }

    await this.model
      .deleteMany({ workspaceId: workspace._id, email: dto.email, acceptedAt: null })
      .exec();

    const token = randomBytes(32).toString('base64url');
    const invite = await this.model.create({
      workspaceId: workspace._id,
      email: dto.email,
      role: dto.role,
      tokenHash: sha256Hex(token),
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      invitedBy,
    });

    if (user) {
      await this.members
        .updateOne(
          { workspaceId: workspace._id, userId: user._id },
          { $set: { role: dto.role, status: 'invited', invitedBy } },
          { upsert: true },
        )
        .exec();
    }

    const acceptUrl = this.acceptUrl(token);

    await this.mail.send({
      to: dto.email,
      subject: `Convite para o workspace ${workspace.name}`,
      text: `Você foi convidado para o workspace ${workspace.name}. Acesse ${acceptUrl} para aceitar.`,
    });

    return { invite, token, acceptUrl };
  }

  /** Invites still waiting for an answer. */
  async listPending(
    workspaceId: Types.ObjectId,
    query: PaginationQueryDto,
  ): Promise<CursorPage<InviteDocument>> {
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const filter = query.cursor
      ? { workspaceId, acceptedAt: null, _id: { $gt: decodeObjectIdCursor(query.cursor) } }
      : { workspaceId, acceptedAt: null };

    const docs = await this.model
      .find(filter)
      .sort({ _id: 1 })
      .limit(limit + 1)
      .exec();

    return buildCursorPage(docs, limit, (doc) => ({ id: String(doc._id) }));
  }

  async cancel(workspaceId: Types.ObjectId, inviteId: Types.ObjectId): Promise<void> {
    const invite = await this.model
      .findOne({ _id: inviteId, workspaceId, acceptedAt: null })
      .exec();

    if (!invite) {
      throw new NotFoundException({
        code: 'INVITE_NOT_FOUND',
        message: 'Convite não encontrado.',
      });
    }

    const user = await this.usersService.findByEmail(invite.email);

    if (user) {
      await this.members.deleteOne({ workspaceId, userId: user._id, status: 'invited' }).exec();
    }

    await invite.deleteOne();
  }

  /** Accepts the invite with an existing account or creates the account on the fly. */
  async accept(dto: AcceptInviteDto): Promise<AcceptedInvite> {
    const invite = await this.model.findOne({ tokenHash: sha256Hex(dto.token) }).exec();

    if (!invite) {
      throw new NotFoundException({
        code: 'INVITE_NOT_FOUND',
        message: 'Convite não encontrado.',
      });
    }

    if (invite.acceptedAt) {
      throw new ConflictException({
        code: 'INVITE_ALREADY_ACCEPTED',
        message: 'Este convite já foi aceito.',
      });
    }

    if (invite.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException({
        code: 'INVITE_EXPIRED',
        message: 'Este convite expirou. Peça um novo convite.',
      });
    }

    const workspace = await this.workspaces
      .findOne({ _id: invite.workspaceId, deletedAt: null })
      .exec();

    if (!workspace) {
      throw new NotFoundException({
        code: 'WORKSPACE_NOT_FOUND',
        message: 'Workspace não encontrado.',
      });
    }

    let user = await this.usersService.findByEmail(invite.email);
    let accountCreated = false;

    if (!user) {
      if (!dto.name || !dto.password) {
        throw new BadRequestException({
          code: 'ACCOUNT_REQUIRED',
          message: 'Informe nome e senha para criar a sua conta.',
        });
      }

      user = await this.usersService.create({
        name: dto.name,
        email: invite.email,
        password: dto.password,
      });
      accountCreated = true;
    }

    const member = await this.joinWorkspace(workspace, user._id, invite);

    invite.acceptedAt = new Date();
    await invite.save();

    return {
      workspace: { id: String(workspace._id), name: workspace.name, slug: workspace.slug },
      member,
      accountCreated,
    };
  }

  private async joinWorkspace(
    workspace: WorkspaceDocument,
    userId: Types.ObjectId,
    invite: InviteDocument,
  ): Promise<WorkspaceMemberDocument> {
    const existing = await this.members.findOne({ workspaceId: workspace._id, userId }).exec();

    if (existing?.status === 'active') {
      throw new ConflictException({
        code: 'ALREADY_MEMBER',
        message: 'Esta pessoa já é membro do workspace.',
      });
    }

    const member = await this.members
      .findOneAndUpdate(
        { workspaceId: workspace._id, userId },
        {
          $set: {
            role: invite.role,
            status: 'active',
            invitedBy: invite.invitedBy,
            joinedAt: new Date(),
          },
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      )
      .exec();

    if (!member) {
      throw new ConflictException({
        code: 'MEMBERSHIP_FAILED',
        message: 'Não foi possível concluir a entrada no workspace.',
      });
    }

    return member;
  }

  private acceptUrl(token: string): string {
    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:5173';

    return `${appUrl.replace(/\/+$/, '')}/convites/aceitar?token=${token}`;
  }
}
