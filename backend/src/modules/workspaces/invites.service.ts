import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { randomBytes } from 'node:crypto';
import { Model, Types } from 'mongoose';
import { CursorPage, buildCursorPage, decodeObjectIdCursor } from '../../common/pagination/cursor';
import {
  DEFAULT_PAGE_SIZE,
  PaginationQueryDto,
} from '../../common/pagination/pagination-query.dto';
import { sha256Hex } from '../../common/utils/hash';
import { describeMailError } from '../mail/mail-error';
import { MailService } from '../mail/mail.service';

import { buildInviteEmail } from '../mail/templates/invite-email';
import { UsersService } from '../users/users.service';
import { AcceptInviteDto, CreateInviteDto } from './dto/invite.dto';
import { INVITE_TTL_DAYS, INVITE_TTL_MS, Invite, InviteDocument } from './schemas/invite.schema';
import { WorkspaceMember, WorkspaceMemberDocument } from './schemas/workspace-member.schema';
import { Workspace, WorkspaceDocument } from './schemas/workspace.schema';
import { RequestMembership } from './workspace-context';
import { WorkspaceRole } from './workspace-roles';
import { MEMBER_INVITED, MemberInvitedEvent } from './workspace-events';

const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  member: 'Membro',
  limited: 'Acesso limitado',
  guest: 'Convidado',
};

export interface CreatedInvite {
  invite: InviteDocument;
  token: string;
  acceptUrl: string;
  /** false quando o convite foi criado mas o e-mail nao saiu. */
  emailSent: boolean;
}

export interface AcceptedInvite {
  workspace: { id: string; name: string; slug: string };
  member: WorkspaceMemberDocument;
  accountCreated: boolean;
}

@Injectable()
export class InvitesService {
  private readonly logger = new Logger(InvitesService.name);

  constructor(
    @InjectModel(Invite.name) private readonly model: Model<Invite>,
    @InjectModel(WorkspaceMember.name) private readonly members: Model<WorkspaceMember>,
    @InjectModel(Workspace.name) private readonly workspaces: Model<Workspace>,
    private readonly usersService: UsersService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly events: EventEmitter2,
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
          {
            $set: { role: dto.role, status: 'invited', invitedBy },
            // Keeps _id generation (and therefore the cursor order) on the driver side.
            $setOnInsert: { _id: new Types.ObjectId() },
          },
          { upsert: true },
        )
        .exec();
    }

    const acceptUrl = this.acceptUrl(token);

    // O convite ja esta gravado: uma falha de SMTP nao pode derrubar a criacao,
    // senao sobra convite orfao no banco e o 500 nao diz o que fazer.
    let emailSent = true;

    try {
      await this.mail.send(
        buildInviteEmail({
          to: dto.email,
          workspaceName: workspace.name,
          roleLabel: ROLE_LABELS[dto.role],
          acceptUrl,
          expiresInDays: INVITE_TTL_DAYS,
          inviterName: await this.inviterName(invitedBy),
        }),
      );
    } catch (error) {
      emailSent = false;
      this.logger.error(
        `[invite] e-mail não enviado para ${dto.email}: ${describeMailError(error)}`,
      );
    }

    if (user) {
      this.events.emit(MEMBER_INVITED, {
        workspaceId: workspace._id,
        workspaceName: workspace.name,
        userId: user._id,
        email: dto.email,
        role: dto.role,
        actorId: invitedBy,
        acceptUrl,
      } satisfies MemberInvitedEvent);
    }

    return { invite, token, acceptUrl, emailSent };
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
    const { invite, workspace } = await this.requirePendingInvite(dto.token);

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

  /**
   * Accepts the invite for a user who just signed in (Google login). The e-mail has
   * to match the invite, so a token cannot pull another account into the workspace.
   */
  async acceptForUser(
    token: string,
    userId: Types.ObjectId,
    email: string,
  ): Promise<AcceptedInvite> {
    const { invite, workspace } = await this.requirePendingInvite(token);

    if (invite.email !== email.trim().toLowerCase()) {
      throw new BadRequestException({
        code: 'INVITE_EMAIL_MISMATCH',
        message: 'Este convite foi enviado para outro e-mail.',
      });
    }

    const member = await this.joinWorkspace(workspace, userId, invite);

    invite.acceptedAt = new Date();
    await invite.save();

    return {
      workspace: { id: String(workspace._id), name: workspace.name, slug: workspace.slug },
      member,
      accountCreated: false,
    };
  }

  /** The invite and its workspace, checked for existence, expiry and reuse. */
  private async requirePendingInvite(
    token: string,
  ): Promise<{ invite: InviteDocument; workspace: WorkspaceDocument }> {
    const invite = await this.model.findOne({ tokenHash: sha256Hex(token) }).exec();

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

    return { invite, workspace };
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

  /** The invite reads better signed; a missing name just drops that sentence. */
  private async inviterName(invitedBy: Types.ObjectId): Promise<string | undefined> {
    try {
      const names = await this.usersService.namesByIds([invitedBy]);
      const name = names.get(String(invitedBy))?.trim();

      return name && name.length > 0 ? name : undefined;
    } catch {
      return undefined;
    }
  }

  private acceptUrl(token: string): string {
    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:5173';

    return `${appUrl.replace(/\/+$/, '')}/convite/${token}`;
  }
}
