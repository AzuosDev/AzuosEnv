import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { CronTime } from 'cron';
import { Model, Types } from 'mongoose';
import { CursorPage, buildCursorPage, decodeObjectIdCursor } from '../../common/pagination/cursor';
import {
  DEFAULT_PAGE_SIZE,
  PaginationQueryDto,
} from '../../common/pagination/pagination-query.dto';
import { PermissionContext } from '../hierarchy/permission.service';
import { AI_AGENTS_CHANGED, AiAgentsChangedEvent } from './ai-events';
import { CreateAiAgentDto, UpdateAiAgentDto } from './dto/ai.dto';
import { AiAgent, AiAgentDocument } from './schemas/ai-agent.schema';

/** CRUD of the scheduled agents. The type is immutable, like the scope of a field. */
@Injectable()
export class AiAgentsService {
  constructor(
    @InjectModel(AiAgent.name) private readonly model: Model<AiAgent>,
    private readonly events: EventEmitter2,
  ) {}

  async create(ctx: PermissionContext, dto: CreateAiAgentDto): Promise<AiAgentDocument> {
    this.assertCron(dto.cron);

    const agent = await this.model.create({
      workspaceId: ctx.workspaceId,
      name: dto.name,
      type: dto.type,
      cron: dto.cron,
      config: this.plain(dto.config),
      active: dto.active ?? true,
      createdBy: ctx.userId,
    });

    this.changed(ctx.workspaceId);

    return agent;
  }

  async list(
    ctx: PermissionContext,
    query: PaginationQueryDto,
  ): Promise<CursorPage<AiAgentDocument>> {
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const base = { workspaceId: ctx.workspaceId };
    const docs = await this.model
      .find(query.cursor ? { ...base, _id: { $lt: decodeObjectIdCursor(query.cursor) } } : base)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .exec();

    return buildCursorPage(docs, limit, (doc) => ({ id: String(doc._id) }));
  }

  async get(ctx: PermissionContext, agentId: Types.ObjectId): Promise<AiAgentDocument> {
    const agent = await this.model.findOne({ _id: agentId, workspaceId: ctx.workspaceId }).exec();

    if (!agent) {
      throw this.notFound();
    }

    return agent;
  }

  async update(
    ctx: PermissionContext,
    agentId: Types.ObjectId,
    dto: UpdateAiAgentDto,
  ): Promise<AiAgentDocument> {
    const agent = await this.get(ctx, agentId);

    if (dto.cron !== undefined) {
      this.assertCron(dto.cron);
      agent.cron = dto.cron;
    }

    if (dto.name !== undefined) {
      agent.name = dto.name;
    }

    if (dto.config !== undefined) {
      agent.config = this.plain(dto.config);
    }

    if (dto.active !== undefined) {
      agent.active = dto.active;
    }

    await agent.save();
    this.changed(ctx.workspaceId);

    return agent;
  }

  async remove(ctx: PermissionContext, agentId: Types.ObjectId): Promise<void> {
    const agent = await this.get(ctx, agentId);

    await this.model.deleteOne({ _id: agent._id }).exec();
    this.changed(ctx.workspaceId);
  }

  /** Every active agent of every workspace; read by the scheduler. */
  active(): Promise<AiAgentDocument[]> {
    return this.model.find({ active: true }).exec();
  }

  notFound(): NotFoundException {
    return new NotFoundException({
      code: 'AI_AGENT_NOT_FOUND',
      message: 'Agente de IA não encontrado.',
    });
  }

  /** The cron is validated here so an invalid expression never reaches the registry. */
  private assertCron(cron: string): void {
    try {
      new CronTime(cron);
    } catch {
      throw new BadRequestException({
        code: 'INVALID_AI_AGENT',
        message: 'Expressão cron inválida.',
      });
    }
  }

  /** Same reason as the config of a view: the DTO instance would carry undefined. */
  private plain(config?: Record<string, unknown>): Record<string, unknown> {
    return config ? (JSON.parse(JSON.stringify(config)) as Record<string, unknown>) : {};
  }

  private changed(workspaceId: Types.ObjectId): void {
    this.events.emit(AI_AGENTS_CHANGED, {
      workspaceId: String(workspaceId),
    } satisfies AiAgentsChangedEvent);
  }
}
