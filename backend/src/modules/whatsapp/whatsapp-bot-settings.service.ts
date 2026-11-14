import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PermissionContext } from '../hierarchy/permission.service';
import { WorkspaceMember } from '../workspaces/schemas/workspace-member.schema';
import {
  CreateWaBotRuleDto,
  SaveWaBotSettingsDto,
  UpdateWaBotRuleDto,
  WaBotRuleActionDto,
  WaBotRuleReplyDto,
  WaBotRuleTriggerDto,
} from './dto/whatsapp-bot.dto';
import {
  WaBotRule,
  WaBotRuleAction,
  WaBotRuleDocument,
  WaBotRuleReply,
} from './schemas/wa-bot-rule.schema';
import { WaBotSettings, WaBotSettingsDocument } from './schemas/wa-bot-settings.schema';
import { MAX_WA_BUTTONS, MAX_WA_LIST_ROWS, WaMenuKind } from './whatsapp-fields';

/** Triggers whose `value` carries the thing to match. */
const VALUE_TRIGGERS = ['keyword', 'contains', 'regex', 'menuOption'] as const;

/**
 * Settings of the bot and the rules of the attendance. It holds no reference to
 * the messages, so the engine and the sending path can both depend on it.
 */
@Injectable()
export class WhatsappBotSettingsService {
  constructor(
    @InjectModel(WaBotSettings.name) private readonly model: Model<WaBotSettings>,
    @InjectModel(WaBotRule.name) private readonly rules: Model<WaBotRule>,
    @InjectModel(WorkspaceMember.name) private readonly members: Model<WorkspaceMember>,
  ) {}

  ruleNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'WHATSAPP_BOT_RULE_NOT_FOUND',
      message: 'Regra do bot não encontrada.',
    });
  }

  /** Settings of the workspace; a workspace that never saved them answers null. */
  async find(workspaceId: Types.ObjectId): Promise<WaBotSettingsDocument | null> {
    return this.model.findOne({ workspaceId }).exec();
  }

  /** Settings of the workspace, with the defaults written on the first read. */
  async get(workspaceId: Types.ObjectId): Promise<WaBotSettingsDocument> {
    const existing = await this.find(workspaceId);

    if (existing) {
      return existing;
    }

    return this.model.create({ workspaceId });
  }

  /** Minutes an answer of an attendant pauses the bot for; 0 means never. */
  async pauseMinutesFor(workspaceId: Types.ObjectId): Promise<number> {
    const settings = await this.find(workspaceId);

    if (!settings || !settings.enabled) {
      return 0;
    }

    return Math.max(0, settings.pauseMinutes);
  }

  async save(ctx: PermissionContext, dto: SaveWaBotSettingsDto): Promise<WaBotSettingsDocument> {
    const settings = await this.get(ctx.workspaceId);

    if (dto.enabled !== undefined) {
      settings.enabled = dto.enabled;
    }

    if (dto.welcomeMessage !== undefined) {
      settings.welcomeMessage = dto.welcomeMessage;
    }

    if (dto.handoffMessage !== undefined) {
      settings.handoffMessage = dto.handoffMessage;
    }

    if (dto.closingMessage !== undefined) {
      settings.closingMessage = dto.closingMessage;
    }

    if (dto.pauseMinutes !== undefined) {
      settings.pauseMinutes = dto.pauseMinutes;
    }

    if (dto.menu) {
      const kind: WaMenuKind = dto.menu.kind ?? settings.menu.kind;
      const options = dto.menu.options ?? settings.menu.options;

      this.assertOptions(kind, options.length);

      settings.menu = {
        enabled: dto.menu.enabled ?? settings.menu.enabled,
        kind,
        header: dto.menu.header ?? settings.menu.header,
        body: dto.menu.body ?? settings.menu.body,
        footer: dto.menu.footer ?? settings.menu.footer,
        buttonLabel: dto.menu.buttonLabel ?? settings.menu.buttonLabel,
        options: options.map((option) => ({
          id: option.id,
          title: option.title,
          description: option.description ?? '',
        })),
      };
    }

    if (dto.ai) {
      settings.ai = {
        enabled: dto.ai.enabled ?? settings.ai.enabled,
        knowledgeBase: dto.ai.knowledgeBase ?? settings.ai.knowledgeBase,
        maxAnswerChars: dto.ai.maxAnswerChars ?? settings.ai.maxAnswerChars,
      };
    }

    if (dto.hours) {
      settings.hours = {
        enabled: dto.hours.enabled ?? settings.hours.enabled,
        timezone: dto.hours.timezone ?? settings.hours.timezone,
        days: (dto.hours.days ?? settings.hours.days).map((day) => ({
          weekday: day.weekday,
          ranges: day.ranges.map((range) => ({ start: range.start, end: range.end })),
        })),
        holidays: (dto.hours.holidays ?? settings.hours.holidays).map((holiday) => ({
          date: holiday.date,
          name: holiday.name ?? '',
        })),
        awayMessage: dto.hours.awayMessage ?? settings.hours.awayMessage,
      };
    }

    settings.updatedBy = ctx.userId;
    await settings.save();

    return settings;
  }

  /** Every rule of the workspace, newest configuration first. */
  async listRules(workspaceId: Types.ObjectId): Promise<WaBotRuleDocument[]> {
    return this.rules.find({ workspaceId }).sort({ priority: -1, _id: 1 }).exec();
  }

  /** Rules the engine may fire. */
  async activeRules(workspaceId: Types.ObjectId): Promise<WaBotRuleDocument[]> {
    return this.rules.find({ workspaceId, active: true }).sort({ priority: -1, _id: 1 }).exec();
  }

  async createRule(ctx: PermissionContext, dto: CreateWaBotRuleDto): Promise<WaBotRuleDocument> {
    await this.assertRule(ctx, dto.trigger, dto.reply, dto.actions);

    return this.rules.create({
      workspaceId: ctx.workspaceId,
      name: dto.name,
      trigger: { kind: dto.trigger.kind, value: dto.trigger.value ?? '' },
      reply: this.replyOf(dto.reply),
      actions: this.actionsOf(dto.actions),
      priority: dto.priority ?? 0,
      active: dto.active ?? true,
      createdBy: ctx.userId,
    });
  }

  async updateRule(
    ctx: PermissionContext,
    ruleId: Types.ObjectId,
    dto: UpdateWaBotRuleDto,
  ): Promise<WaBotRuleDocument> {
    const rule = await this.requireRule(ctx, ruleId);

    await this.assertRule(ctx, dto.trigger ?? rule.trigger, dto.reply, dto.actions);

    if (dto.name !== undefined) {
      rule.name = dto.name;
    }

    if (dto.trigger) {
      rule.trigger = { kind: dto.trigger.kind, value: dto.trigger.value ?? '' };
    }

    if (dto.reply) {
      rule.reply = this.replyOf(dto.reply);
    }

    if (dto.actions) {
      rule.actions = this.actionsOf(dto.actions);
    }

    if (dto.priority !== undefined) {
      rule.priority = dto.priority;
    }

    if (dto.active !== undefined) {
      rule.active = dto.active;
    }

    await rule.save();

    return rule;
  }

  async removeRule(ctx: PermissionContext, ruleId: Types.ObjectId): Promise<void> {
    const rule = await this.requireRule(ctx, ruleId);

    await this.rules.deleteOne({ _id: rule._id }).exec();
  }

  private async requireRule(
    ctx: PermissionContext,
    ruleId: Types.ObjectId,
  ): Promise<WaBotRuleDocument> {
    const rule = await this.rules.findOne({ _id: ruleId, workspaceId: ctx.workspaceId }).exec();

    if (!rule) {
      throw this.ruleNotFound();
    }

    return rule;
  }

  private replyOf(dto: WaBotRuleReplyDto | undefined): WaBotRuleReply {
    return {
      kind: dto?.kind ?? 'text',
      text: dto?.text ?? '',
      mediaUrl: dto?.mediaUrl ?? '',
      mediaMime: dto?.mediaMime ?? '',
      filename: dto?.filename ?? '',
      header: dto?.header ?? '',
      footer: dto?.footer ?? '',
      buttonLabel: dto?.buttonLabel ?? 'Ver opções',
      options: (dto?.options ?? []).map((option) => ({
        id: option.id,
        title: option.title,
        description: option.description ?? '',
      })),
    };
  }

  private actionsOf(dtos: WaBotRuleActionDto[] | undefined): WaBotRuleAction[] {
    return (dtos ?? []).map((action) => ({
      kind: action.kind,
      userId: action.userId ? new Types.ObjectId(action.userId) : null,
      tag: action.tag ?? '',
      priority: action.priority ?? 'high',
      listId: action.listId ? new Types.ObjectId(action.listId) : null,
    }));
  }

  /** Keeps a rule that cannot work from ever being saved. */
  private async assertRule(
    ctx: PermissionContext,
    trigger: WaBotRuleTriggerDto | { kind: string; value: string },
    reply: WaBotRuleReplyDto | undefined,
    actions: WaBotRuleActionDto[] | undefined,
  ): Promise<void> {
    const kind = trigger.kind as (typeof VALUE_TRIGGERS)[number];
    const value = (trigger.value ?? '').trim();

    if ((VALUE_TRIGGERS as readonly string[]).includes(kind) && value.length === 0) {
      throw this.invalid('Este gatilho precisa de um valor.');
    }

    if (trigger.kind === 'regex') {
      try {
        new RegExp(value, 'i');
      } catch {
        throw this.invalid('A expressão regular da regra não é válida.');
      }
    }

    if (reply) {
      const replyKind = reply.kind ?? 'text';

      if (replyKind === 'text' && (reply.text ?? '').trim().length === 0) {
        throw this.invalid('A resposta de texto precisa de conteúdo.');
      }

      if (replyKind === 'media' && (reply.mediaUrl ?? '').trim().length === 0) {
        throw this.invalid('A resposta de mídia precisa de um link.');
      }

      if (replyKind === 'buttons' || replyKind === 'list') {
        const options = reply.options ?? [];

        if (options.length === 0) {
          throw this.invalid('A resposta interativa precisa de pelo menos uma opção.');
        }

        this.assertOptions(replyKind === 'list' ? 'list' : 'buttons', options.length);
      }
    }

    for (const action of actions ?? []) {
      if (action.kind === 'assign') {
        if (!action.userId) {
          throw this.invalid('A ação de atribuir precisa de um responsável.');
        }

        await this.assertMember(ctx, new Types.ObjectId(action.userId));
      }

      if (action.kind === 'tag' && (action.tag ?? '').trim().length === 0) {
        throw this.invalid('A ação de etiqueta precisa de um nome.');
      }
    }
  }

  private assertOptions(kind: WaMenuKind, total: number): void {
    const max = kind === 'list' ? MAX_WA_LIST_ROWS : MAX_WA_BUTTONS;

    if (total > max) {
      throw this.invalid(
        kind === 'list'
          ? `A lista interativa aceita no máximo ${MAX_WA_LIST_ROWS} opções.`
          : `O menu de botões aceita no máximo ${MAX_WA_BUTTONS} opções.`,
      );
    }
  }

  private async assertMember(ctx: PermissionContext, userId: Types.ObjectId): Promise<void> {
    const member = await this.members
      .findOne({ workspaceId: ctx.workspaceId, userId, status: 'active' })
      .exec();

    if (!member) {
      throw new BadRequestException({
        code: 'INVALID_ASSIGNEE',
        message: 'Responsável não é membro ativo do workspace.',
      });
    }
  }

  private invalid(message: string): BadRequestException {
    return new BadRequestException({ code: 'WHATSAPP_BOT_RULE_INVALID', message });
  }
}
