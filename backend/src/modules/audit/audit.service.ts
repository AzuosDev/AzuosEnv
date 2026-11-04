import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CursorPage, buildCursorPage, decodeObjectIdCursor } from '../../common/pagination/cursor';
import { DEFAULT_PAGE_SIZE } from '../../common/pagination/pagination-query.dto';
import { AuditEntityType } from './audit-fields';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';
import { AuditQueryDto } from './dto/audit-query.dto';

export interface AuditRecord {
  workspaceId: Types.ObjectId;
  actorId: Types.ObjectId | null;
  action: string;
  entityType: AuditEntityType;
  entityId?: Types.ObjectId | null;
  details?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@InjectModel(AuditLog.name) private readonly model: Model<AuditLog>) {}

  /** Writing the trail never breaks the action that was audited. */
  async record(record: AuditRecord): Promise<void> {
    try {
      await this.model.create({
        workspaceId: record.workspaceId,
        actorId: record.actorId,
        action: record.action,
        entityType: record.entityType,
        entityId: record.entityId ?? null,
        details: record.details ?? {},
        ip: record.ip ?? '',
        userAgent: record.userAgent ?? '',
      });
    } catch (error: unknown) {
      this.logger.error(
        `Falha ao registrar auditoria de ${record.action}.`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async list(
    workspaceId: Types.ObjectId,
    query: AuditQueryDto,
  ): Promise<CursorPage<AuditLogDocument>> {
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const filter: Record<string, unknown> = { workspaceId };

    if (query.action) {
      filter.action = query.action;
    }

    if (query.actorId) {
      filter.actorId = new Types.ObjectId(query.actorId);
    }

    if (query.cursor) {
      filter._id = { $lt: decodeObjectIdCursor(query.cursor) };
    }

    const docs = await this.model
      .find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate('actorId', 'name email avatarUrl')
      .exec();

    return buildCursorPage(docs, limit, (doc) => ({ id: String(doc._id) }));
  }
}
