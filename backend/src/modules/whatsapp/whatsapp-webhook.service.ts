import { ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Types } from 'mongoose';
import { verifyBody } from '../integrations/webhooks/webhook-signature';
import { WaCredentials } from './graph/whatsapp-graph.provider';
import {
  WaConnectionWithCredentials,
  WhatsappConnectionsService,
} from './whatsapp-connections.service';
import { WhatsappContactsService } from './whatsapp-contacts.service';
import { WhatsappConversationsService } from './whatsapp-conversations.service';
import { WhatsappMessagesService } from './whatsapp-messages.service';
import { WaWebhookChange, readChanges, readPhoneNumberId } from './whatsapp-payload';

export interface WaWebhookVerification {
  mode: string | undefined;
  verifyToken: string | undefined;
  challenge: string | undefined;
}

export interface WaWebhookRequest {
  rawBody: Buffer | undefined;
  signature: string | undefined;
  body: Record<string, unknown>;
}

export interface WaWebhookResult {
  received: true;
  /** Why nothing was queued, when the delivery was accepted but not applied. */
  ignored?: string;
}

/**
 * Public entry point of the Cloud API. The GET answers the handshake of Meta; the
 * POST checks the signature over the raw body, picks the workspace by the
 * phone_number_id and hands the payload to the queue, which runs after the 200.
 */
@Injectable()
export class WhatsappWebhookService {
  private readonly logger = new Logger(WhatsappWebhookService.name);

  /** Serial queue of the deliveries; `settle` is what the e2e waits on. */
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly connections: WhatsappConnectionsService,
    private readonly contacts: WhatsappContactsService,
    private readonly conversations: WhatsappConversationsService,
    private readonly messages: WhatsappMessagesService,
  ) {}

  /** Handshake of the subscription: the challenge comes back in plain text. */
  async verify(input: WaWebhookVerification): Promise<string> {
    const token = input.verifyToken ?? '';

    if (
      input.mode !== 'subscribe' ||
      token.length === 0 ||
      !(await this.connections.matchesVerifyToken(token))
    ) {
      throw new ForbiddenException({
        code: 'WHATSAPP_VERIFY_FAILED',
        message: 'Verificação do webhook recusada.',
      });
    }

    return input.challenge ?? '';
  }

  /** Validates the delivery and queues the processing; answers right away. */
  async receive(request: WaWebhookRequest): Promise<WaWebhookResult> {
    const phoneNumberId = readPhoneNumberId(request.body);

    if (!phoneNumberId) {
      return { received: true, ignored: 'phone-number-missing' };
    }

    const found = await this.connections.byPhoneNumberId(phoneNumberId);

    if (!found) {
      return { received: true, ignored: 'number-not-connected' };
    }

    if (
      !request.rawBody ||
      !verifyBody(request.rawBody, found.appSecret, request.signature ?? undefined)
    ) {
      throw new UnauthorizedException({
        code: 'INVALID_SIGNATURE',
        message: 'Assinatura do webhook inválida.',
      });
    }

    await this.connections.touch(found.connection._id);

    const changes = readChanges(request.body);

    this.enqueue(found, changes);

    return { received: true };
  }

  /** Resolves once everything already queued has been processed. */
  async settle(): Promise<void> {
    await this.queue;
  }

  private enqueue(found: WaConnectionWithCredentials, changes: WaWebhookChange[]): void {
    this.queue = this.queue
      .then(() => this.process(found, changes))
      .catch((error: unknown) => {
        this.logger.error(
          `Falha ao processar o webhook do WhatsApp: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });
  }

  private async process(
    found: WaConnectionWithCredentials,
    changes: WaWebhookChange[],
  ): Promise<void> {
    const workspaceId = found.connection.workspaceId;

    for (const change of changes) {
      for (const status of change.statuses) {
        await this.messages.applyStatus(workspaceId, status);
      }

      const profiles = new Map(
        change.contacts.map((contact) => [contact.waId, contact.profileName]),
      );

      for (const message of change.messages) {
        await this.ingest(found.credentials, workspaceId, message, profiles);
      }
    }
  }

  private async ingest(
    credentials: WaCredentials,
    workspaceId: Types.ObjectId,
    message: WaWebhookChange['messages'][number],
    profiles: Map<string, string>,
  ): Promise<void> {
    const contact = await this.contacts.upsertFromInbound(
      workspaceId,
      message.from,
      profiles.get(message.from) ?? '',
      message.sentAt,
    );
    const { conversation, created } = await this.conversations.openFor(
      workspaceId,
      contact,
      message.sentAt,
    );
    const stored = await this.messages.ingestInbound(conversation, message, credentials);

    if (!stored) {
      return;
    }

    await this.conversations.touchInbound(conversation, message.sentAt);

    if (created && !conversation.assigneeId) {
      await this.conversations.notifyNewConversation(conversation);

      return;
    }

    await this.conversations.notifyInbound(conversation, stored.body);
  }
}
