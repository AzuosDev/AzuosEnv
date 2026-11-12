import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { MembersService } from '../workspaces/members.service';
import { TeamsService } from '../workspaces/teams.service';
import { ResourceQueryDto, ShareDto } from './dto/permission.dto';
import { HierarchyAccessService } from './hierarchy-access.service';
import { ShareableResourceType } from './permission-levels';
import { PermissionContext, PermissionService } from './permission.service';
import { PermissionDocument } from './schemas/permission.schema';

/** Sharing of Spaces, Folders and Lists with users and teams. */
@Injectable()
export class SharingService {
  constructor(
    private readonly access: HierarchyAccessService,
    private readonly permissions: PermissionService,
    private readonly members: MembersService,
    private readonly teams: TeamsService,
  ) {}

  async share(ctx: PermissionContext, dto: ShareDto): Promise<PermissionDocument> {
    await this.requireManageable(ctx, dto.resourceType, new Types.ObjectId(dto.resourceId));
    await this.requirePrincipal(ctx, dto.principalType, new Types.ObjectId(dto.principalId));

    return this.permissions.share(ctx.workspaceId, {
      resourceType: dto.resourceType,
      resourceId: new Types.ObjectId(dto.resourceId),
      principalType: dto.principalType,
      principalId: new Types.ObjectId(dto.principalId),
      level: dto.level,
      createdBy: ctx.userId,
    });
  }

  async list(ctx: PermissionContext, query: ResourceQueryDto): Promise<PermissionDocument[]> {
    await this.requireManageable(ctx, query.resourceType, new Types.ObjectId(query.resourceId));

    return this.permissions.listForResource(
      ctx.workspaceId,
      query.resourceType,
      new Types.ObjectId(query.resourceId),
    );
  }

  async unshare(ctx: PermissionContext, permissionId: Types.ObjectId): Promise<void> {
    const permission = await this.permissions.findById(ctx.workspaceId, permissionId);

    if (!permission) {
      throw this.permissionNotFound();
    }

    await this.requireManageable(
      ctx,
      permission.resourceType as ShareableResourceType,
      permission.resourceId,
    );

    if (!(await this.permissions.unshare(ctx.workspaceId, permissionId))) {
      throw this.permissionNotFound();
    }
  }

  /** Only someone with full access over the resource can change its sharing. */
  private async requireManageable(
    ctx: PermissionContext,
    resourceType: ShareableResourceType,
    resourceId: Types.ObjectId,
  ): Promise<void> {
    if (resourceType === 'space') {
      await this.access.requireSpace(ctx, resourceId, 'full');
      return;
    }

    if (resourceType === 'folder') {
      await this.access.requireFolder(ctx, resourceId, 'full');
      return;
    }

    await this.access.requireList(ctx, resourceId, 'full');
  }

  private async requirePrincipal(
    ctx: PermissionContext,
    principalType: 'user' | 'team',
    principalId: Types.ObjectId,
  ): Promise<void> {
    const valid =
      principalType === 'user'
        ? (await this.members.activeUserIds(ctx.workspaceId, [principalId])).length === 1
        : await this.teams.existsInWorkspace(ctx.workspaceId, principalId);

    if (!valid) {
      throw new BadRequestException({
        code: 'INVALID_PRINCIPAL',
        message: 'Compartilhe apenas com membros ativos ou equipes do workspace.',
      });
    }
  }

  private permissionNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'PERMISSION_NOT_FOUND',
      message: 'Compartilhamento não encontrado.',
    });
  }
}
