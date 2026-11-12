import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CursorPage, buildCursorPage, decodeObjectIdCursor } from '../../common/pagination/cursor';
import {
  DEFAULT_PAGE_SIZE,
  PaginationQueryDto,
} from '../../common/pagination/pagination-query.dto';
import { slugify } from '../../common/utils/slug';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { WorkspaceMember, WorkspaceMemberDocument } from './schemas/workspace-member.schema';
import { Workspace, WorkspaceDocument } from './schemas/workspace.schema';
import { RequestMembership, toRequestMembership } from './workspace-context';

export interface ResolvedWorkspace {
  workspace: WorkspaceDocument;
  membership: RequestMembership;
}

const MAX_SLUG_ATTEMPTS = 50;

/** AZD from "Azuos Dev"; falls back to WS when the name has no letters. */
export function taskPrefixFromName(name: string): string {
  const letters = slugify(name).replace(/[^a-z0-9]/g, '');
  const prefix = letters.slice(0, 3).toUpperCase();

  return /^[A-Z][A-Z0-9]{1,5}$/.test(prefix) ? prefix : 'WS';
}

@Injectable()
export class WorkspacesService {
  constructor(
    @InjectModel(Workspace.name) private readonly model: Model<Workspace>,
    @InjectModel(WorkspaceMember.name) private readonly members: Model<WorkspaceMember>,
  ) {}

  /** Creates the workspace and the owner membership of its creator. */
  async create(userId: string, dto: CreateWorkspaceDto): Promise<WorkspaceDocument> {
    const ownerId = new Types.ObjectId(userId);
    const workspace = await this.model.create({
      name: dto.name,
      slug: await this.uniqueSlug(dto.slug ?? dto.name),
      logoUrl: dto.logoUrl,
      color: dto.color,
      taskPrefix: dto.taskPrefix ?? taskPrefixFromName(dto.name),
      ownerId,
      timezone: dto.timezone,
    });

    await this.members.create({
      workspaceId: workspace._id,
      userId: ownerId,
      role: 'owner',
      status: 'active',
      joinedAt: new Date(),
    });

    return workspace;
  }

  /** Workspaces where the user is an active member. */
  async listForUser(
    userId: string,
    query: PaginationQueryDto,
  ): Promise<CursorPage<WorkspaceDocument>> {
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const memberships = await this.members
      .find({ userId: new Types.ObjectId(userId), status: 'active' })
      .select('workspaceId')
      .exec();

    const ids = memberships.map((member) => member.workspaceId);
    const cursorId = query.cursor ? decodeObjectIdCursor(query.cursor) : null;
    const filter = cursorId
      ? { _id: { $in: ids, $gt: cursorId }, deletedAt: null }
      : { _id: { $in: ids }, deletedAt: null };

    const docs = await this.model
      .find(filter)
      .sort({ _id: 1 })
      .limit(limit + 1)
      .exec();

    return buildCursorPage(docs, limit, (doc) => ({ id: String(doc._id) }));
  }

  /** Used by the WorkspaceGuard: unknown workspace or inactive member means 404. */
  async resolveContext(wsId: string | undefined, userId: string): Promise<ResolvedWorkspace> {
    if (!wsId || !Types.ObjectId.isValid(wsId)) {
      throw this.workspaceNotFound();
    }

    const workspace = await this.model
      .findOne({ _id: new Types.ObjectId(wsId), deletedAt: null })
      .exec();

    const member = workspace
      ? await this.members
          .findOne({
            workspaceId: workspace._id,
            userId: new Types.ObjectId(userId),
            status: 'active',
          })
          .exec()
      : null;

    if (!workspace || !member) {
      throw this.workspaceNotFound();
    }

    return { workspace, membership: toRequestMembership(member) };
  }

  async update(workspace: WorkspaceDocument, dto: UpdateWorkspaceDto): Promise<WorkspaceDocument> {
    if (dto.slug !== undefined && dto.slug !== workspace.slug) {
      workspace.slug = await this.uniqueSlug(dto.slug, workspace._id);
    }

    if (dto.name !== undefined) {
      workspace.name = dto.name;
    }

    if (dto.logoUrl !== undefined) {
      workspace.logoUrl = dto.logoUrl;
    }

    if (dto.color !== undefined) {
      workspace.color = dto.color;
    }

    if (dto.taskPrefix !== undefined) {
      workspace.taskPrefix = dto.taskPrefix;
    }

    if (dto.timezone !== undefined) {
      workspace.timezone = dto.timezone;
    }

    for (const [key, value] of Object.entries(dto.settings?.clickApps ?? {})) {
      if (value !== undefined) {
        workspace.set(`settings.clickApps.${key}`, value);
      }
    }

    return workspace.save();
  }

  /** Soft delete: the workspace stops being resolvable but the data stays. */
  async softDelete(workspace: WorkspaceDocument): Promise<void> {
    workspace.deletedAt = new Date();
    await workspace.save();
  }

  /** The target becomes owner and the previous owner stays as admin. */
  async transferOwnership(
    workspace: WorkspaceDocument,
    currentOwner: RequestMembership,
    targetUserId: string,
  ): Promise<WorkspaceMemberDocument> {
    const target = await this.members
      .findOne({
        workspaceId: workspace._id,
        userId: new Types.ObjectId(targetUserId),
        status: 'active',
      })
      .exec();

    if (!target) {
      throw new NotFoundException({
        code: 'MEMBER_NOT_FOUND',
        message: 'Membro não encontrado neste workspace.',
      });
    }

    if (String(target._id) === currentOwner.id) {
      throw new ConflictException({
        code: 'ALREADY_OWNER',
        message: 'Este membro já é o proprietário.',
      });
    }

    await this.members
      .updateOne({ _id: new Types.ObjectId(currentOwner.id) }, { $set: { role: 'admin' } })
      .exec();

    target.role = 'owner';
    await target.save();

    workspace.ownerId = target.userId;
    await workspace.save();

    return target;
  }

  private async uniqueSlug(source: string, ignoreId?: Types.ObjectId): Promise<string> {
    const base = slugify(source);

    for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt += 1) {
      const candidate = attempt === 1 ? base : `${base}-${attempt}`;
      const filter = ignoreId ? { slug: candidate, _id: { $ne: ignoreId } } : { slug: candidate };

      if ((await this.model.countDocuments(filter).exec()) === 0) {
        return candidate;
      }
    }

    return `${base}-${Date.now().toString(36)}`;
  }

  private workspaceNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'WORKSPACE_NOT_FOUND',
      message: 'Workspace não encontrado.',
    });
  }
}
