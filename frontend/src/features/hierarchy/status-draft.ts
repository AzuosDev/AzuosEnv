import type { Status, StatusGroup, StatusInput } from '@/api/types';

/** Status em edição: `key` é estável na tela, `id` só existe se já foi salvo. */
export interface StatusDraft {
  key: string;
  id?: string;
  name: string;
  color: string;
  group: StatusGroup;
}

const DEFAULT_COLOR = '#2563EB';

let counter = 0;

function nextKey(): string {
  counter += 1;

  return `novo-${String(counter)}`;
}

/** Statuses do conjunto na ordem salva, prontos para o editor. */
export function draftFromStatuses(statuses: Status[]): StatusDraft[] {
  return [...statuses]
    .sort((a, b) => a.position - b.position)
    .map((status) => ({
      key: status.id,
      id: status.id,
      name: status.name,
      color: status.color,
      group: status.group,
    }));
}

export function addStatus(draft: StatusDraft[], group: StatusGroup = 'active'): StatusDraft[] {
  return [...draft, { key: nextKey(), name: '', color: DEFAULT_COLOR, group }];
}

export function patchStatus(
  draft: StatusDraft[],
  key: string,
  patch: Partial<Omit<StatusDraft, 'key' | 'id'>>,
): StatusDraft[] {
  return draft.map((status) => (status.key === key ? { ...status, ...patch } : status));
}

export function removeStatus(draft: StatusDraft[], key: string): StatusDraft[] {
  return draft.filter((status) => status.key !== key);
}

/** Move o status uma casa para cima (-1) ou para baixo (1). */
export function moveStatus(draft: StatusDraft[], key: string, offset: number): StatusDraft[] {
  const from = draft.findIndex((status) => status.key === key);
  const to = from + offset;

  if (from < 0 || to < 0 || to >= draft.length) {
    return draft;
  }

  const next = [...draft];
  const [moved] = next.splice(from, 1);

  if (moved) {
    next.splice(to, 0, moved);
  }

  return next;
}

/** Mensagem do primeiro problema do rascunho; null quando pode salvar. */
export function validateDraft(draft: StatusDraft[]): string | null {
  if (draft.length === 0) {
    return 'Mantenha ao menos um status.';
  }

  if (draft.length > 60) {
    return 'O limite é de 60 statuses.';
  }

  const seen = new Set<string>();

  for (const status of draft) {
    const name = status.name.trim();

    if (name.length === 0) {
      return 'Dê um nome a todos os statuses.';
    }

    if (name.length > 60) {
      return `O nome "${name.slice(0, 20)}…" passa de 60 caracteres.`;
    }

    const key = name.toLocaleLowerCase('pt-BR');

    if (seen.has(key)) {
      return `Já existe um status chamado "${name}".`;
    }

    seen.add(key);
  }

  if (!draft.some((status) => status.group === 'done')) {
    return 'Marque ao menos um status como Concluído.';
  }

  return null;
}

/** Rascunho no formato do contrato; a ordem do array é a ordem dos statuses. */
export function toStatusInputs(draft: StatusDraft[]): StatusInput[] {
  return draft.map((status) => ({
    ...(status.id ? { id: status.id } : {}),
    name: status.name.trim(),
    color: status.color,
    group: status.group,
  }));
}
