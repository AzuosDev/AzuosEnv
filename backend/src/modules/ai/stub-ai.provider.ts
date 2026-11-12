import { Injectable } from '@nestjs/common';
import {
  AiCompletion,
  AiCompletionRequest,
  AiProvider,
  AiStreamEvent,
  AiUsage,
} from './ai-provider';

/** Characters per token; only to size the usage rows of the stub. */
const CHARS_PER_TOKEN = 4;

/**
 * Local provider used while no XAI_API_KEY is configured and by every test: it never
 * reaches the network. `script()` queues the answers the next calls return, so a suite
 * can drive tool calling without the real model.
 */
@Injectable()
export class StubAiProvider implements AiProvider {
  private readonly queue: Partial<AiCompletion>[] = [];

  readonly model: string;

  constructor(model: string) {
    this.model = model;
  }

  /** Queues the answers of the next calls, in order. Tests only. */
  script(...completions: Partial<AiCompletion>[]): void {
    this.queue.push(...completions);
  }

  /** Drops whatever is queued; a suite calls it between tests. */
  reset(): void {
    this.queue.length = 0;
  }

  complete(request: AiCompletionRequest): Promise<AiCompletion> {
    return Promise.resolve(this.answer(request));
  }

  async *stream(request: AiCompletionRequest): AsyncIterable<AiStreamEvent> {
    const completion = this.answer(request);

    for (const piece of this.pieces(completion.content)) {
      yield { type: 'delta', text: piece };
    }

    if (completion.toolCalls.length > 0) {
      yield { type: 'toolCalls', toolCalls: completion.toolCalls };
    }

    yield { type: 'end', usage: completion.usage, model: completion.model };
  }

  private answer(request: AiCompletionRequest): AiCompletion {
    const scripted = this.queue.shift();
    const content = scripted?.content ?? this.fallback(request);

    return {
      content,
      toolCalls: scripted?.toolCalls ?? [],
      usage: scripted?.usage ?? this.usage(request, content),
      model: scripted?.model ?? this.model,
    };
  }

  /** Echoes the request so the answer is deterministic and still useful in dev. */
  private fallback(request: AiCompletionRequest): string {
    const prompt = [...request.messages].reverse().find((message) => message.role === 'user');
    const text = (prompt?.content ?? '').trim();

    if (request.responseFormat === 'json_object') {
      return JSON.stringify({
        tasks: this.lines(text).map((line) => ({ name: line.slice(0, 200) })),
      });
    }

    return text.length === 0
      ? '[stub] Sem conteúdo para responder.'
      : `[stub] ${text.slice(0, 500)}`;
  }

  private lines(text: string): string[] {
    const lines = text
      .split('\n')
      .map((line) => line.replace(/^[-*\d.\s]+/, '').trim())
      .filter((line) => line.length > 0);

    return lines.length === 0 ? ['Tarefa sem título'] : lines.slice(0, 10);
  }

  private pieces(content: string): string[] {
    return content.match(/[\s\S]{1,120}/g) ?? [];
  }

  private usage(request: AiCompletionRequest, content: string): AiUsage {
    const input = request.messages.reduce((total, message) => total + message.content.length, 0);

    return {
      tokensIn: Math.ceil(input / CHARS_PER_TOKEN),
      tokensOut: Math.ceil(content.length / CHARS_PER_TOKEN),
    };
  }
}
