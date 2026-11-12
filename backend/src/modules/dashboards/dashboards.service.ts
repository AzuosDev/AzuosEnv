import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { CursorPage, buildCursorPage, decodeObjectIdCursor } from '../../common/pagination/cursor';
import { DEFAULT_PAGE_SIZE } from '../../common/pagination/pagination-query.dto';
import { PermissionContext } from '../hierarchy/permission.service';
import { hasRoleAtLeast } from '../workspaces/workspace-roles';
import {
  CardDto,
  CreateDashboardDto,
  DashboardQueryDto,
  UpdateDashboardDto,
} from './dto/dashboard.dto';
import { Dashboard, DashboardCard, DashboardDocument } from './schemas/dashboard.schema';

@Injectable()
export class DashboardsService {
  constructor(@InjectModel(Dashboard.name) private readonly model: Model<Dashboard>) {}

  dashboardNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'DASHBOARD_NOT_FOUND',
      message: 'Dashboard não encontrado.',
    });
  }

  async create(ctx: PermissionContext, dto: CreateDashboardDto): Promise<DashboardDocument> {
    return this.model.create({
      workspaceId: ctx.workspaceId,
      name: dto.name,
      ownerId: ctx.userId,
      private: dto.private ?? false,
      cards: toCards(dto.cards ?? []),
    });
  }

  /** Private dashboards of other people are left out of the listing. */
  async list(
    ctx: PermissionContext,
    query: DashboardQueryDto,
  ): Promise<CursorPage<DashboardDocument>> {
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const base = {
      workspaceId: ctx.workspaceId,
      $or: [{ private: false }, { ownerId: ctx.userId }],
    };

    const docs = await this.model
      .find(query.cursor ? { ...base, _id: { $lt: decodeObjectIdCursor(query.cursor) } } : base)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .exec();

    return buildCursorPage(docs, limit, (doc) => ({ id: String(doc._id) }));
  }

  async requireVisible(
    ctx: PermissionContext,
    dashboardId: Types.ObjectId,
  ): Promise<DashboardDocument> {
    const dashboard = await this.model
      .findOne({ _id: dashboardId, workspaceId: ctx.workspaceId })
      .exec();

    if (!dashboard || (dashboard.private && !this.isOwner(ctx, dashboard))) {
      throw this.dashboardNotFound();
    }

    return dashboard;
  }

  async update(
    ctx: PermissionContext,
    dashboardId: Types.ObjectId,
    dto: UpdateDashboardDto,
  ): Promise<DashboardDocument> {
    const dashboard = await this.requireWritable(ctx, dashboardId);

    if (dto.name !== undefined) {
      dashboard.name = dto.name;
    }

    if (dto.private !== undefined) {
      dashboard.private = dto.private;
    }

    if (dto.cards !== undefined) {
      dashboard.cards = toCards(dto.cards);
    }

    return dashboard.save();
  }

  async remove(ctx: PermissionContext, dashboardId: Types.ObjectId): Promise<void> {
    const dashboard = await this.requireWritable(ctx, dashboardId);

    await dashboard.deleteOne();
  }

  requireCard(dashboard: DashboardDocument, cardId: string): DashboardCard {
    const card = dashboard.cards.find((item) => item.id === cardId);

    if (!card) {
      throw new NotFoundException({ code: 'CARD_NOT_FOUND', message: 'Card não encontrado.' });
    }

    return card;
  }

  /** Only the owner and the admins change a dashboard. */
  private async requireWritable(
    ctx: PermissionContext,
    dashboardId: Types.ObjectId,
  ): Promise<DashboardDocument> {
    const dashboard = await this.requireVisible(ctx, dashboardId);

    if (!this.isOwner(ctx, dashboard) && !hasRoleAtLeast(ctx.role, 'admin')) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_DASHBOARD',
        message: 'Apenas o dono do dashboard pode alterá-lo.',
      });
    }

    return dashboard;
  }

  private isOwner(ctx: PermissionContext, dashboard: DashboardDocument): boolean {
    return String(dashboard.ownerId) === String(ctx.userId);
  }
}

/**
 * Fills the ids and the geometry the client did not send. The config is stored as
 * plain JSON: the DTO instance carries every optional field as undefined and the
 * driver would write them as null.
 */
function toCards(cards: CardDto[]): DashboardCard[] {
  return cards.map((card) => ({
    id: card.id ?? randomUUID(),
    type: card.type,
    config: plainConfig(card.config),
    x: card.x ?? 0,
    y: card.y ?? 0,
    w: card.w ?? 4,
    h: card.h ?? 4,
  }));
}

export function plainConfig(config: object | undefined): Record<string, unknown> {
  return config ? (JSON.parse(JSON.stringify(config)) as Record<string, unknown>) : {};
}
