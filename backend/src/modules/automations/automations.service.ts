import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { CronTime } from 'cron';
import { Model, Types } from 'mongoose';
import { randomBytes } from 'node:crypto';
import { CursorPage, paginateByIdDesc } from '../../common/pagination/cursor';
import { DEFAULT_PAGE_SIZE } from '../../common/pagination/pagination-query.dto';
import { sha256Hex } from '../../common/utils/hash';
import { API_PREFIX } from '../../app.setup';
import { HierarchyAccessService } from '../hierarchy/hierarchy-access.service';
import { PermissionLevel } from '../hierarchy/permission-levels';
import { PermissionContext } from '../hierarchy/permission.service';
import { ListDocument } from '../hierarchy/schemas/list.schema';
import { AUTOMATIONS_CHANGED } from './automation-events';
import {
  AUTOMATION_CACHE_TTL_MS,
  AutomationLocationType,
  HOOK_SECRET_BYTES,
  HOOK_TRIGGERS,
  TriggerType,
} from './automation-fields';
import {
  ActionDto,
  AutomationQueryDto,
  ConditionDto,
  CreateAutomationDto,
  TriggerDto,
  UpdateAutomationDto,
} from './dto/automation.dto';
import {
  Automation,
  AutomationAction,
  AutomationCondition,
  AutomationDocument,
  AutomationTrigger,
} from './schemas/automation.schema';

/** A created or updated automation plus the hook secret, shown only once. */
export interface AutomationResult {
  automation: AutomationDocument;
  webhookSecret?: string;
  webhookUrl?: string;
}

interface CacheEntry {
  expiresAt: number;
  items: AutomationDocument[];
}

@Injectable()
export class AutomationsService {
  /** Active automations of each List, keyed by `<workspaceId>:<listId>`. */
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    @InjectModel(Automation.name) private readonly model: Model<Automation>,
    private readonly access: HierarchyAccessService,
    private readonly config: ConfigService,
    private readonly events: EventEmitter2,
  ) {}

  automationNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'AUTOMATION_NOT_FOUND',
      message: 'Automação não encontrada.',
    });
  }

  async create(ctx: PermissionContext, dto: CreateAutomationDto): Promise<AutomationResult> {
    const locationId = new Types.ObjectId(dto.locationId);

    await this.requireLocation(ctx, dto.locationType, locationId, 'edit');

    const trigger = this.assertTrigger(dto.trigger);
    const secret = HOOK_TRIGGERS.includes(trigger.type) ? newSecret() : null;
    const automation = await this.model.create({
      workspaceId: ctx.workspaceId,
      locationType: dto.locationType,
      locationId,
      name: dto.name,
      active: dto.active ?? true,
      trigger,
      conditions: toConditions(dto.conditions ?? []),
      actions: this.assertActions(dto.actions),
      secretHash: secret ? sha256Hex(secret) : null,
      createdBy: ctx.userId,
    });

    this.changed(ctx.workspaceId);

    return this.withSecret(automation, secret);
  }

  async list(
    ctx: PermissionContext,
    query: AutomationQueryDto,
  ): Promise<CursorPage<AutomationDocument>> {
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;

    if (query.locationType && query.locationId) {
      await this.requireLocation(
        ctx,
        query.locationType,
        new Types.ObjectId(query.locationId),
        'view',
      );
    }

    const base = {
      workspaceId: ctx.workspaceId,
      ...(query.locationType ? { locationType: query.locationType } : {}),
      ...(query.locationId ? { locationId: new Types.ObjectId(query.locationId) } : {}),
      ...(query.active === undefined ? {} : { active: query.active }),
    };

    const docs = await this.model.find(base).sort({ _id: -1 }).exec();
    const visible: AutomationDocument[] = [];
    const cache = new Map<string, boolean>();

    for (const doc of docs) {
      if (await this.canSeeLocation(ctx, doc, cache)) {
        visible.push(doc);
      }
    }

    return paginateByIdDesc(visible, limit, query.cursor);
  }

  async requireAutomation(
    ctx: PermissionContext,
    automationId: Types.ObjectId,
    required: PermissionLevel,
  ): Promise<AutomationDocument> {
    const automation = await this.model
      .findOne({ _id: automationId, workspaceId: ctx.workspaceId })
      .exec();

    if (!automation) {
      throw this.automationNotFound();
    }

    try {
      await this.requireLocation(ctx, automation.locationType, automation.locationId, required);
    } catch (error) {
      throw error instanceof NotFoundException ? this.automationNotFound() : error;
    }

    return automation;
  }

  async update(
    ctx: PermissionContext,
    automationId: Types.ObjectId,
    dto: UpdateAutomationDto,
  ): Promise<AutomationResult> {
    const automation = await this.requireAutomation(ctx, automationId, 'edit');
    let secret: string | null = null;

    if (dto.name !== undefined) {
      automation.name = dto.name;
    }

    if (dto.active !== undefined) {
      automation.active = dto.active;
    }

    if (dto.trigger !== undefined) {
      automation.trigger = this.assertTrigger(dto.trigger);
    }

    if (dto.conditions !== undefined) {
      automation.conditions = toConditions(dto.conditions);
    }

    if (dto.actions !== undefined) {
      automation.actions = this.assertActions(dto.actions);
    }

    // A hook trigger needs a secret; the one of an older trigger is dropped.
    if (HOOK_TRIGGERS.includes(automation.trigger.type)) {
      if (!(await this.hasSecret(automation._id))) {
        secret = newSecret();
        automation.secretHash = sha256Hex(secret);
      }
    } else {
      automation.secretHash = null;
    }

    await automation.save();
    this.changed(ctx.workspaceId);

    return this.withSecret(automation, secret);
  }

  async remove(ctx: PermissionContext, automationId: Types.ObjectId): Promise<void> {
    const automation = await this.requireAutomation(ctx, automationId, 'edit');

    await this.model.deleteOne({ _id: automation._id, workspaceId: ctx.workspaceId }).exec();
    this.changed(ctx.workspaceId);
  }

  /**
   * Active automations that cover the List: the ones of the List itself plus the
   * ones of its Folders and of its Space. Cached per List for a few seconds and
   * dropped whenever an automation of the workspace is written.
   */
  async forList(list: ListDocument): Promise<AutomationDocument[]> {
    const key = `${String(list.workspaceId)}:${String(list._id)}`;
    const cached = this.cache.get(key);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.items;
    }

    const chain = await this.access.listChain(list);
    const locations: { locationType: AutomationLocationType; locationId: Types.ObjectId }[] = [];

    for (const node of chain) {
      if (isAutomationLocation(node.resourceType)) {
        locations.push({ locationType: node.resourceType, locationId: node.resourceId });
      }
    }

    const items: AutomationDocument[] =
      locations.length === 0
        ? []
        : await this.model
            .find({ workspaceId: list.workspaceId, active: true, $or: locations })
            .sort({ _id: 1 })
            .exec();

    this.cache.set(key, { expiresAt: Date.now() + AUTOMATION_CACHE_TTL_MS, items });

    return items;
  }

  /** Active automations of a trigger type across every workspace, for the crons. */
  activeByTriggers(types: readonly TriggerType[]): Promise<AutomationDocument[]> {
    return this.model
      .find({ active: true, 'trigger.type': { $in: types } })
      .sort({ _id: 1 })
      .exec();
  }

  /** The automation behind a hook URL; a wrong secret is indistinguishable from a wrong id. */
  async findByHook(automationId: string, secret: string): Promise<AutomationDocument | null> {
    if (!Types.ObjectId.isValid(automationId)) {
      return null;
    }

    const automation = await this.model
      .findOne({ _id: new Types.ObjectId(automationId), active: true })
      .select('+secretHash')
      .exec();

    if (!automation?.secretHash || automation.secretHash !== sha256Hex(secret)) {
      return null;
    }

    return automation;
  }

  /** Drops the cache of the workspace and lets the scheduler re-register the crons. */
  changed(workspaceId: Types.ObjectId): void {
    const prefix = `${String(workspaceId)}:`;

    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }

    this.events.emit(AUTOMATIONS_CHANGED, { workspaceId });
  }

  private async hasSecret(automationId: Types.ObjectId): Promise<boolean> {
    const current = await this.model.findById(automationId).select('+secretHash').exec();

    return Boolean(current?.secretHash);
  }

  private withSecret(automation: AutomationDocument, secret: string | null): AutomationResult {
    if (!secret) {
      return { automation };
    }

    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:5173';

    return {
      automation,
      webhookSecret: secret,
      webhookUrl: `${appUrl.replace(/\/+$/, '')}/${API_PREFIX}/hooks/${String(automation._id)}/${secret}`,
    };
  }

  private assertTrigger(dto: TriggerDto): AutomationTrigger {
    const params = plainParams(dto.params);

    if (dto.type === 'schedule') {
      const cron = typeof params.cron === 'string' ? params.cron.trim() : '';

      if (!cron) {
        throw this.invalid('A automação agendada exige uma expressão cron.');
      }

      try {
        new CronTime(cron, typeof params.timezone === 'string' ? params.timezone : undefined);
      } catch {
        throw this.invalid('Expressão cron inválida.');
      }

      params.cron = cron;
    }

    return { type: dto.type, params };
  }

  private assertActions(actions: ActionDto[]): AutomationAction[] {
    if (actions.length === 0) {
      throw this.invalid('A automação precisa de pelo menos uma ação.');
    }

    return actions.map((action) => {
      const params = plainParams(action.params);

      if (action.type === 'callWebhook' && typeof params.url !== 'string') {
        throw this.invalid('A ação callWebhook exige uma url.');
      }

      if (action.type === 'applyTemplate' && typeof params.templateId !== 'string') {
        throw this.invalid('A ação applyTemplate exige um templateId.');
      }

      if (action.type === 'createTask' && typeof params.listId !== 'string') {
        throw this.invalid('A ação createTask exige uma listId.');
      }

      if (action.type === 'setCustomField' && typeof params.fieldId !== 'string') {
        throw this.invalid('A ação setCustomField exige um fieldId.');
      }

      if (action.type === 'setStatus' && !params.statusId && !params.statusGroup) {
        throw this.invalid('A ação setStatus exige statusId ou statusGroup.');
      }

      return { type: action.type, params };
    });
  }

  private invalid(message: string): BadRequestException {
    return new BadRequestException({ code: 'INVALID_AUTOMATION', message });
  }

  private async canSeeLocation(
    ctx: PermissionContext,
    automation: AutomationDocument,
    cache: Map<string, boolean>,
  ): Promise<boolean> {
    const key = `${automation.locationType}:${String(automation.locationId)}`;
    const cached = cache.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const allowed = await this.requireLocation(
      ctx,
      automation.locationType,
      automation.locationId,
      'view',
    )
      .then(() => true)
      .catch(() => false);

    cache.set(key, allowed);

    return allowed;
  }

  private async requireLocation(
    ctx: PermissionContext,
    locationType: AutomationLocationType,
    locationId: Types.ObjectId,
    required: PermissionLevel,
  ): Promise<void> {
    if (locationType === 'space') {
      await this.access.requireSpace(ctx, locationId, required);

      return;
    }

    if (locationType === 'folder') {
      await this.access.requireFolder(ctx, locationId, required);

      return;
    }

    await this.access.requireList(ctx, locationId, required);
  }
}

/**
 * Params are stored as plain JSON: the DTO instance carries every optional field
 * as undefined and the driver would write those as null.
 */
function plainParams(params: object | undefined): Record<string, unknown> {
  return params ? (JSON.parse(JSON.stringify(params)) as Record<string, unknown>) : {};
}

function toConditions(conditions: ConditionDto[]): AutomationCondition[] {
  return conditions.map((condition) => ({
    field: condition.field,
    op: condition.op,
    value: condition.value === undefined ? null : condition.value,
  }));
}

function isAutomationLocation(value: string): value is AutomationLocationType {
  return value === 'space' || value === 'folder' || value === 'list';
}

function newSecret(): string {
  return randomBytes(HOOK_SECRET_BYTES).toString('base64url');
}
