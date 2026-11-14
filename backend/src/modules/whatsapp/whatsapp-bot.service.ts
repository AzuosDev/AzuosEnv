import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { safeTimeZone } from '../../common/utils/timezone';
import { AI_PROVIDER, AiProvider } from '../ai/ai-provider';
import { AiUsageService } from '../ai/ai-usage.service';
import { PermissionContext } from '../hierarchy/permission.service';
import { WorkspaceMember } from '../workspaces/schemas/workspace-member.schema';
import { Workspace } from '../workspaces/schemas/workspace.schema';
import { WaCredentials, WaInteractive, WaOutbound } from './graph/whatsapp-graph.provider';
import { WaBotRuleDocument } from './schemas/wa-bot-rule.schema';
import { WaBotSettingsDocument, WaMenuOption } from './schemas/wa-bot-settings.schema';
import { WaContactDocument } from './schemas/wa-contact.schema';
import { WaConversationDocument } from './schemas/wa-conversation.schema';
import { WaMessageDocument } from './schemas/wa-message.schema';
import { isWithinWaHours } from './whatsapp-bot-hours';
import { WaInboundFacts, matchWaContextRule, matchWaRule } from './whatsapp-bot-match';
import { WaTextVariables, renderWaText } from './whatsapp-bot-text';
import { WhatsappBotSettingsService } from './whatsapp-bot-settings.service';
import { WhatsappContactsService } from './whatsapp-contacts.service';
import { WhatsappConnectionsService } from './whatsapp-connections.service';
import { WhatsappConversationsService } from './whatsapp-conversations.service';
import {
  MAX_WA_AI_QUESTION_CHARS,
  MAX_WA_KNOWLEDGE_CHARS,
  WA_AI_HANDOFF_TOKEN,
} from './whatsapp-fields';
import { WhatsappMessagesService } from './whatsapp-messages.service';
import { WhatsappTasksService } from './whatsapp-tasks.service';

/** The bot only reacts to something the contact can actually have meant. */
const ACTIONABLE_TYPES = new Set(['text', 'interactive', 'button']);

/**
 * Engine of the bot. It runs after an inbound message is stored and only acts on
 * a conversation in `bot` mode that is not paused: an attendant answering holds
 * it back until `botPausedUntil`, and putting the conversation back on the bot
 * clears that date.
 */
@Injectable()
export class WhatsappBotService {
  private readonly logger = new Logger(WhatsappBotService.name);

  constructor(
    @InjectModel(Workspace.name) private readonly workspaces: Model<Workspace>,
    @InjectModel(WorkspaceMember.name) private readonly members: Model<WorkspaceMember>,
    private readonly settings: WhatsappBotSettingsService,
    private readonly conversations: WhatsappConversationsService,
    private readonly contacts: WhatsappContactsService,
    private readonly connections: WhatsappConnectionsService,
    private readonly messages: WhatsappMessagesService,
    private readonly tasks: WhatsappTasksService,
    private readonly usage: AiUsageService,
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
  ) {}

  /**
   * Reacts to one inbound message. A failure here never breaks the delivery of the
   * webhook: it is logged and the message stays in the history all the same.
   */
  async handleInbound(
    conversation: WaConversationDocument,
    message: WaMessageDocument,
    credentials: WaCredentials,
  ): Promise<void> {
    try {
      await this.react(conversation, message, credentials);
    } catch (error) {
      this.logger.warn(
        `O bot do WhatsApp não conseguiu responder a conversa ${String(conversation._id)}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /** Closing message of the attendance, sent when an attendant finishes. */
  async onClosed(conversation: WaConversationDocument): Promise<void> {
    try {
      const settings = await this.settings.find(conversation.workspaceId);

      if (!settings?.enabled || settings.closingMessage.trim().length === 0) {
        return;
      }

      const contact = await this.contacts.byId(conversation.workspaceId, conversation.contactId);

      if (!contact) {
        return;
      }

      await this.send(conversation, contact, await this.credentialsOf(conversation), {
        type: 'text',
        text: renderWaText(settings.closingMessage, this.variablesOf(contact)),
      });
    } catch (error) {
      this.logger.warn(
        `Não foi possível enviar a mensagem de encerramento: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async react(
    conversation: WaConversationDocument,
    message: WaMessageDocument,
    credentials: WaCredentials,
  ): Promise<void> {
    const settings = await this.settings.find(conversation.workspaceId);

    if (!settings?.enabled || !this.awake(conversation)) {
      return;
    }

    if (message.direction !== 'inbound' || !ACTIONABLE_TYPES.has(message.type)) {
      return;
    }

    const contact = await this.contacts.byId(conversation.workspaceId, conversation.contactId);

    if (!contact || contact.optOut) {
      return;
    }

    const workspace = await this.workspaces.findOne({ _id: conversation.workspaceId }).exec();
    const open = isWithinWaHours(settings.hours, message.sentAt, safeTimeZone(workspace?.timezone));
    const facts: WaInboundFacts = {
      text: message.body,
      optionId: this.optionIdOf(message),
      firstMessage: (await this.messages.countInbound(conversation)) <= 1,
      outsideHours: !open,
    };
    const rules = await this.settings.activeRules(conversation.workspaceId);
    const candidates = rules.map((rule) => ({
      rule,
      trigger: rule.trigger,
      priority: rule.priority,
      active: rule.active,
      order: String(rule._id),
    }));

    if (!open) {
      const closed = matchWaContextRule(candidates, 'outsideHours', facts);

      if (closed) {
        await this.apply(conversation, contact, credentials, settings, closed.rule);

        return;
      }

      await this.sendText(conversation, contact, credentials, settings.hours.awayMessage);

      return;
    }

    if (facts.firstMessage) {
      const greeting = matchWaContextRule(candidates, 'firstMessage', facts);

      if (greeting) {
        await this.apply(conversation, contact, credentials, settings, greeting.rule);

        return;
      }

      await this.sendText(conversation, contact, credentials, settings.welcomeMessage);
      await this.sendMenu(conversation, contact, credentials, settings);

      return;
    }

    const matched = matchWaRule(candidates, facts);

    if (matched) {
      await this.apply(conversation, contact, credentials, settings, matched.rule);

      return;
    }

    await this.answerWithAi(conversation, contact, credentials, settings, message.body);
  }

  /** True when the conversation is on the bot and the pause already expired. */
  private awake(conversation: WaConversationDocument): boolean {
    if (conversation.mode !== 'bot') {
      return false;
    }

    return (
      conversation.botPausedUntil === null || conversation.botPausedUntil.getTime() <= Date.now()
    );
  }

  /** Id of the button or the list row the contact tapped. */
  private optionIdOf(message: WaMessageDocument): string | null {
    const id = message.payload?.id;

    return typeof id === 'string' && id.length > 0 ? id : null;
  }

  private async apply(
    conversation: WaConversationDocument,
    contact: WaContactDocument,
    credentials: WaCredentials,
    settings: WaBotSettingsDocument,
    rule: WaBotRuleDocument,
  ): Promise<void> {
    const variables = this.variablesOf(contact);
    const { reply } = rule;

    if (reply.kind === 'text') {
      await this.sendText(conversation, contact, credentials, reply.text);
    }

    if (reply.kind === 'media' && reply.mediaUrl.length > 0) {
      await this.send(conversation, contact, credentials, {
        type: reply.mediaMime.startsWith('image/') ? 'image' : 'document',
        mediaLink: reply.mediaUrl,
        mediaMime: reply.mediaMime,
        caption: renderWaText(reply.text, variables),
        filename: reply.filename,
      });
    }

    if ((reply.kind === 'buttons' || reply.kind === 'list') && reply.options.length > 0) {
      await this.send(conversation, contact, credentials, {
        type: 'interactive',
        interactive: this.interactiveOf(
          reply.kind === 'list' ? 'list' : 'buttons',
          renderWaText(reply.text, variables),
          reply.header,
          reply.footer,
          reply.buttonLabel,
          reply.options,
        ),
      });
    }

    for (const action of rule.actions) {
      await this.runAction(conversation, contact, credentials, settings, rule, action);
    }
  }

  private async runAction(
    conversation: WaConversationDocument,
    contact: WaContactDocument,
    credentials: WaCredentials,
    settings: WaBotSettingsDocument,
    rule: WaBotRuleDocument,
    action: WaBotRuleDocument['actions'][number],
  ): Promise<void> {
    if (action.kind === 'transferToHuman') {
      await this.handoff(conversation, contact, credentials, settings);

      return;
    }

    if (action.kind === 'assign' && action.userId) {
      conversation.assigneeId = action.userId;
      conversation.mode = 'human';
      conversation.botPausedUntil = null;
      await conversation.save();
      this.conversations.emitUpdated(conversation);
      await this.conversations.notifyAssignee(conversation, action.userId, null);

      return;
    }

    if (action.kind === 'priority') {
      conversation.priority = action.priority;
      await conversation.save();
      this.conversations.emitUpdated(conversation);

      return;
    }

    if (action.kind === 'tag') {
      if (!contact.tags.includes(action.tag)) {
        contact.tags = [...contact.tags, action.tag];
        await contact.save();
      }

      return;
    }

    await this.createLead(conversation, rule, action.listId);
  }

  /** Hands the conversation to a human: the bot goes quiet and says so. */
  private async handoff(
    conversation: WaConversationDocument,
    contact: WaContactDocument,
    credentials: WaCredentials,
    settings: WaBotSettingsDocument,
  ): Promise<void> {
    await this.sendText(conversation, contact, credentials, settings.handoffMessage);

    conversation.mode = 'human';
    conversation.botPausedUntil = null;
    await conversation.save();
    this.conversations.emitUpdated(conversation);

    if (!conversation.assigneeId) {
      await this.conversations.notifyNewConversation(conversation);
    }
  }

  /** Lead of the conversation, created as the gestor who wrote the rule. */
  private async createLead(
    conversation: WaConversationDocument,
    rule: WaBotRuleDocument,
    listId: Types.ObjectId | null,
  ): Promise<void> {
    const actor = await this.actorOf(conversation.workspaceId, rule.createdBy);

    if (!actor) {
      return;
    }

    await this.tasks.createLead(actor, 'gestor', conversation._id, {
      listId: listId ? String(listId) : undefined,
    });
  }

  private async actorOf(
    workspaceId: Types.ObjectId,
    userId: Types.ObjectId,
  ): Promise<PermissionContext | null> {
    const member = await this.members.findOne({ workspaceId, userId, status: 'active' }).exec();

    return member ? { workspaceId, userId, role: member.role } : null;
  }

  /**
   * Answer written by the model out of the knowledge base. With the ClickApp `ai`
   * off, the AI off or a model that does not know, nothing is answered and the
   * conversation goes to a human only when the AI was supposed to handle it.
   */
  private async answerWithAi(
    conversation: WaConversationDocument,
    contact: WaContactDocument,
    credentials: WaCredentials,
    settings: WaBotSettingsDocument,
    question: string,
  ): Promise<void> {
    if (!settings.ai.enabled || settings.ai.knowledgeBase.trim().length === 0) {
      return;
    }

    const workspace = await this.workspaces.findOne({ _id: conversation.workspaceId }).exec();

    if (workspace?.settings?.clickApps?.ai === false) {
      return;
    }

    const answer = await this.askAi(conversation.workspaceId, settings, question);

    if (answer === null) {
      await this.handoff(conversation, contact, credentials, settings);

      return;
    }

    await this.sendText(conversation, contact, credentials, answer);
  }

  /** Text of the model, or null when it must go to a human. */
  private async askAi(
    workspaceId: Types.ObjectId,
    settings: WaBotSettingsDocument,
    question: string,
  ): Promise<string | null> {
    const limit = settings.ai.maxAnswerChars;

    try {
      await this.usage.assertBudget(workspaceId);

      const completion = await this.ai.complete({
        temperature: 0.2,
        messages: [
          { role: 'system', content: this.aiPrompt(settings, limit) },
          { role: 'user', content: question.slice(0, MAX_WA_AI_QUESTION_CHARS) },
        ],
      });

      await this.usage.record({
        workspaceId,
        userId: null,
        feature: 'whatsappBot',
        usage: completion.usage,
        model: completion.model,
      });

      const text = completion.content.trim();

      if (text.length === 0 || text.toUpperCase().includes(WA_AI_HANDOFF_TOKEN)) {
        return null;
      }

      return text.slice(0, limit);
    } catch (error) {
      this.logger.warn(
        `A IA não respondeu o WhatsApp: ${error instanceof Error ? error.message : String(error)}`,
      );

      return null;
    }
  }

  private aiPrompt(settings: WaBotSettingsDocument, limit: number): string {
    return [
      'Você é o atendente virtual de uma empresa no WhatsApp.',
      `Responda em português do Brasil, em no máximo ${limit} caracteres.`,
      'Use apenas as informações da base de conhecimento abaixo.',
      'Nunca prometa preço, desconto, prazo, data de entrega ou condição comercial.',
      `Se a base não responder a pergunta, escreva apenas ${WA_AI_HANDOFF_TOKEN}.`,
      '',
      'BASE DE CONHECIMENTO:',
      settings.ai.knowledgeBase.slice(0, MAX_WA_KNOWLEDGE_CHARS),
    ].join('\n');
  }

  private async sendMenu(
    conversation: WaConversationDocument,
    contact: WaContactDocument,
    credentials: WaCredentials,
    settings: WaBotSettingsDocument,
  ): Promise<void> {
    const { menu } = settings;

    if (!menu.enabled || menu.options.length === 0) {
      return;
    }

    await this.send(conversation, contact, credentials, {
      type: 'interactive',
      interactive: this.interactiveOf(
        menu.kind,
        renderWaText(menu.body, this.variablesOf(contact)),
        menu.header,
        menu.footer,
        menu.buttonLabel,
        menu.options,
      ),
    });
  }

  private interactiveOf(
    kind: WaInteractive['kind'],
    body: string,
    header: string,
    footer: string,
    buttonLabel: string,
    options: WaMenuOption[],
  ): WaInteractive {
    return {
      kind,
      body,
      header: header || undefined,
      footer: footer || undefined,
      buttonLabel: buttonLabel || undefined,
      options: options.map((option) => ({
        id: option.id,
        title: option.title,
        description: option.description || undefined,
      })),
    };
  }

  private async sendText(
    conversation: WaConversationDocument,
    contact: WaContactDocument,
    credentials: WaCredentials,
    text: string,
  ): Promise<void> {
    const body = renderWaText(text, this.variablesOf(contact)).trim();

    if (body.length === 0) {
      return;
    }

    await this.send(conversation, contact, credentials, { type: 'text', text: body });
  }

  private async send(
    conversation: WaConversationDocument,
    contact: WaContactDocument,
    credentials: WaCredentials,
    outbound: Omit<WaOutbound, 'to'>,
  ): Promise<void> {
    await this.messages.sendFromBot(conversation, contact, credentials, outbound);
  }

  private variablesOf(contact: WaContactDocument): WaTextVariables {
    return {
      nome: contact.name || contact.profileName || contact.waId,
      numero: contact.waId,
    };
  }

  private async credentialsOf(conversation: WaConversationDocument): Promise<WaCredentials> {
    return (await this.connections.requireCredentials(conversation.workspaceId)).credentials;
  }
}
