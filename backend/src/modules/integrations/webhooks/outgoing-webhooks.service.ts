import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomBytes } from 'node:crypto';
import {
  CursorPage,
  buildCursorPage,
  decodeObjectIdCursor,
} from '../../../common/pagination/cursor';
import {
  DEFAULT_PAGE_SIZE,
  PaginationQueryDto,
} from '../../../common/pagination/pagination-query.dto';
import { PermissionContext } from '../../hierarchy/permission.service';
import { SecretsService } from '../../secrets/secrets.service';
import { MAX_WEBHOOKS_PER_WORKSPACE, WEBHOOK_SECRET_BYTES } from './webhook-fields';
import { CreateOutgoingWebhookDto, UpdateOutgoingWebhookDto } from './dto/outgoing-webhook.dto';
import { OutgoingWebhook, OutgoingWebhookDocument } from './schemas/outgoing-webhook.schema';
import { WebhookDelivery, WebhookDeliveryDocument } from './schemas/webhook-delivery.schema';

export interface WebhookWithSecret {
  webhook: OutgoingWebhookDocument;
  /** Shown only when the secret is created or rotated. */
  secret: string | null;
}

@Injectable()
export class OutgoingWebhooksService {
  constructor(
    @InjectModel(OutgoingWebhook.name) private readonly model: Model<OutgoingWebhook>,
    @InjectModel(WebhookDelivery.name) private readonly deliveries: Model<WebhookDelivery>,
    private readonly secrets: SecretsService,
  ) {}

  async create(ctx: PermissionContext, dto: CreateOutgoingWebhookDto): Promise<WebhookWithSecret> {
    const total = await this.model.countDocuments({ workspaceId: ctx.workspaceId }).exec();

    if (total >= MAX_WEBHOOKS_PER_WORKSPACE) {
      throw new BadRequestException({
        code: 'INVALID_WEBHOOK',
        message: `Este workspace já tem ${MAX_WEBHOOKS_PER_WORKSPACE} webhooks.`,
      });
    }

    const secret = this.newSecret();
    const webhook = await this.model.create({
      workspaceId: ctx.workspaceId,
      url: dto.url,
      events: dto.events,
      secret: this.secrets.encrypt(secret),
      active: dto.active ?? true,
      createdBy: ctx.userId,
    });

    return { webhook, secret };
  }

  async list(ctx: PermissionContext): Promise<{ items: OutgoingWebhookDocument[] }> {
    return {
      items: await this.model.find({ workspaceId: ctx.workspaceId }).sort({ _id: -1 }).exec(),
    };
  }

  async get(ctx: PermissionContext, webhookId: Types.ObjectId): Promise<OutgoingWebhookDocument> {
    const webhook = await this.model
      .findOne({ _id: webhookId, workspaceId: ctx.workspaceId })
      .exec();

    if (!webhook) {
      throw new NotFoundException({
        code: 'WEBHOOK_NOT_FOUND',
        message: 'Webhook não encontrado.',
      });
    }

    return webhook;
  }

  async update(
    ctx: PermissionContext,
    webhookId: Types.ObjectId,
    dto: UpdateOutgoingWebhookDto,
  ): Promise<WebhookWithSecret> {
    const webhook = await this.get(ctx, webhookId);
    let secret: string | null = null;

    if (dto.url !== undefined) {
      webhook.url = dto.url;
    }

    if (dto.events !== undefined) {
      webhook.events = dto.events;
    }

    if (dto.active !== undefined) {
      webhook.active = dto.active;
    }

    if (dto.rotateSecret) {
      secret = this.newSecret();
      webhook.secret = this.secrets.encrypt(secret);
    }

    await webhook.save();

    return { webhook, secret };
  }

  async remove(ctx: PermissionContext, webhookId: Types.ObjectId): Promise<void> {
    const webhook = await this.get(ctx, webhookId);

    await this.deliveries.deleteMany({ webhookId: webhook._id }).exec();
    await this.model.deleteOne({ _id: webhook._id }).exec();
  }

  /** Delivery log of the webhook, newest first. */
  async deliveriesOf(
    ctx: PermissionContext,
    webhookId: Types.ObjectId,
    query: PaginationQueryDto,
  ): Promise<CursorPage<WebhookDeliveryDocument>> {
    const webhook = await this.get(ctx, webhookId);
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const filter: Record<string, unknown> = {
      workspaceId: ctx.workspaceId,
      webhookId: webhook._id,
    };

    if (query.cursor) {
      filter._id = { $lt: decodeObjectIdCursor(query.cursor) };
    }

    const docs = await this.deliveries
      .find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .exec();

    return buildCursorPage(docs, limit, (doc) => ({ id: String(doc._id) }));
  }

  private newSecret(): string {
    return randomBytes(WEBHOOK_SECRET_BYTES).toString('base64url');
  }
}
