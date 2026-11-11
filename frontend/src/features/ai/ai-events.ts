/** Blocos que o SSE de /ai/chat entrega, um JSON por evento. */
export type AiChatEvent =
  | { type: 'start'; conversationId: string }
  | { type: 'delta'; text: string }
  | { type: 'tool'; name: string; result: Record<string, unknown> }
  | { type: 'done'; conversationId: string; model?: string }
  | { type: 'error'; code?: string; message?: string };

/** Tarefa citada pela IA; vira chip clicável embaixo da resposta. */
export interface TaskChip {
  id: string;
  customId: string;
  name: string;
}

const TYPES = ['start', 'delta', 'tool', 'done', 'error'];

function asEvent(raw: unknown): AiChatEvent | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const record = raw as Record<string, unknown>;

  if (typeof record.type !== 'string' || !TYPES.includes(record.type)) {
    return null;
  }

  return record as unknown as AiChatEvent;
}

/**
 * Corta o pedaço recebido em eventos completos e devolve o resto do buffer,
 * que só fecha no próximo pedaço. Puro: o hook guarda o `rest`.
 */
export function parseSse(buffer: string): { events: AiChatEvent[]; rest: string } {
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';
  const events: AiChatEvent[] = [];

  for (const part of parts) {
    for (const line of part.split('\n')) {
      if (!line.startsWith('data:')) {
        continue;
      }

      try {
        const event = asEvent(JSON.parse(line.slice(5).trim()));

        if (event) {
          events.push(event);
        }
      } catch {
        // Bloco partido pela rede: o pedaço seguinte traz o JSON inteiro.
      }
    }
  }

  return { events, rest };
}

function chipOf(raw: unknown): TaskChip | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const { id, customId, name } = record;

  if (typeof id !== 'string' || typeof customId !== 'string') {
    return null;
  }

  return { id, customId, name: typeof name === 'string' ? name : customId };
}

/** Tarefas que apareceram no resultado das ferramentas, sem repetir. */
export function citedTasks(results: Record<string, unknown>[]): TaskChip[] {
  const chips = new Map<string, TaskChip>();

  for (const result of results) {
    const pools = [result.items, result.tasks, [result.task]];

    for (const pool of pools) {
      if (!Array.isArray(pool)) {
        continue;
      }

      for (const item of pool) {
        const chip = chipOf(item);

        if (chip && !chips.has(chip.id)) {
          chips.set(chip.id, chip);
        }
      }
    }
  }

  return [...chips.values()];
}
