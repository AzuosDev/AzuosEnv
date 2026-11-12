import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PermissionContext } from '../hierarchy/permission.service';
import { contextText, redactValue } from './ai-context';
import {
  MAX_CONTEXT_MESSAGE_CHARS,
  MAX_HISTORY_MESSAGES,
  MAX_TOOL_RESULT_CHARS,
  MAX_TOOL_ROUNDS,
} from './ai-fields';
import { chatSystemPrompt } from './ai-prompts';
import { AI_PROVIDER, AiMessage, AiProvider, AiToolCall, AiUsage } from './ai-provider';
import { AI_TOOLS } from './ai-tools';
import { AiToolsService } from './ai-tools.service';
import { AiUsageService } from './ai-usage.service';
import { AiChatDto } from './dto/ai.dto';
import { AiConversation, AiConversationDocument } from './schemas/ai-conversation.schema';

/** Everything the stream of the chat sends to the browser, in order. */
export type AiChatEvent =
  | { type: 'start'; conversationId: string }
  | { type: 'delta'; text: string }
  | { type: 'tool'; name: string; result: Record<string, unknown> }
  | { type: 'done'; conversationId: string; usage: AiUsage; model: string };

export interface AiChatSession {
  ctx: PermissionContext;
  timeZone: string;
  conversation: AiConversationDocument;
  messages: AiMessage[];
}

export interface StartChatInput {
  ctx: PermissionContext;
  workspaceName: string;
  timeZone: string;
  dto: AiChatDto;
}

/**
 * Chat about the workspace. The tools run on the server with the permissions of the
 * user, the history lives in ai_conversations and the context is always truncated.
 */
@Injectable()
export class AiChatService {
  constructor(
    @InjectModel(AiConversation.name) private readonly conversations: Model<AiConversation>,
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
    private readonly tools: AiToolsService,
    private readonly usage: AiUsageService,
  ) {}

  /**
   * Checked and loaded before the response starts streaming, so a blocked request
   * still answers with a JSON error instead of an SSE body.
   */
  async start(input: StartChatInput): Promise<AiChatSession> {
    await this.usage.assertAllowed(input.ctx.workspaceId, input.ctx.userId);

    const conversation = await this.conversation(input.ctx, input.dto.conversationId);
    const question = contextText(input.dto.message, MAX_CONTEXT_MESSAGE_CHARS);

    conversation.messages.push({
      role: 'user',
      content: question,
      toolCalls: [],
      toolCallId: null,
      at: new Date(),
    });

    return {
      ctx: input.ctx,
      timeZone: input.timeZone,
      conversation,
      messages: [
        { role: 'system', content: chatSystemPrompt(input.workspaceName, input.timeZone) },
        ...this.history(conversation),
      ],
    };
  }

  async *stream(session: AiChatSession): AsyncIterable<AiChatEvent> {
    const total: AiUsage = { tokensIn: 0, tokensOut: 0 };
    let model = this.provider.model;

    yield { type: 'start', conversationId: String(session.conversation._id) };

    for (let round = 1; round <= MAX_TOOL_ROUNDS; round += 1) {
      const last = round === MAX_TOOL_ROUNDS;
      let content = '';
      let calls: AiToolCall[] = [];

      for await (const event of this.provider.stream({
        messages: session.messages,
        tools: last ? undefined : AI_TOOLS,
      })) {
        if (event.type === 'delta') {
          content += event.text;
          yield { type: 'delta', text: event.text };
        }

        if (event.type === 'toolCalls') {
          calls = event.toolCalls;
        }

        if (event.type === 'end') {
          total.tokensIn += event.usage.tokensIn;
          total.tokensOut += event.usage.tokensOut;
          model = event.model;
        }
      }

      this.remember(session, { role: 'assistant', content, toolCalls: calls });

      if (calls.length === 0) {
        break;
      }

      for (const call of calls) {
        const result = redactValue(
          await this.tools.run(session.ctx, session.timeZone, call),
        ) as Record<string, unknown>;

        yield { type: 'tool', name: call.name, result };

        this.remember(session, {
          role: 'tool',
          content: contextText(JSON.stringify(result), MAX_TOOL_RESULT_CHARS),
          toolCallId: call.id,
        });
      }
    }

    await this.persist(session);
    await this.usage.record({
      workspaceId: session.ctx.workspaceId,
      userId: session.ctx.userId,
      feature: 'chat',
      usage: total,
      model,
    });

    yield {
      type: 'done',
      conversationId: String(session.conversation._id),
      usage: total,
      model,
    };
  }

  /** Keeps the turn both in the context of the model and in the stored history. */
  private remember(session: AiChatSession, message: AiMessage): void {
    session.messages.push(message);
    session.conversation.messages.push({
      role: message.role,
      content: message.content,
      toolCalls: message.toolCalls ?? [],
      toolCallId: message.toolCallId ?? null,
      at: new Date(),
    });
  }

  /** Only the last turns travel to the model; the rest stays in the database. */
  private history(conversation: AiConversationDocument): AiMessage[] {
    return conversation.messages.slice(-MAX_HISTORY_MESSAGES).map((message) => ({
      role: message.role,
      content: message.content,
      ...(message.toolCalls.length > 0 ? { toolCalls: message.toolCalls } : {}),
      ...(message.toolCallId ? { toolCallId: message.toolCallId } : {}),
    }));
  }

  private async conversation(
    ctx: PermissionContext,
    conversationId?: string,
  ): Promise<AiConversationDocument> {
    if (!conversationId) {
      return new this.conversations({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        title: '',
        messages: [],
      });
    }

    const found = await this.conversations
      .findOne({
        _id: new Types.ObjectId(conversationId),
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
      })
      .exec();

    if (!found) {
      throw new NotFoundException({
        code: 'AI_CONVERSATION_NOT_FOUND',
        message: 'Conversa não encontrada.',
      });
    }

    return found;
  }

  private async persist(session: AiChatSession): Promise<void> {
    const first = session.conversation.messages.find((message) => message.role === 'user');

    if (session.conversation.title.length === 0 && first) {
      session.conversation.title = first.content.slice(0, 80);
    }

    session.conversation.lastMessageAt = new Date();
    await session.conversation.save();
  }
}
