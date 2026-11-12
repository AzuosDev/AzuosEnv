/** Expandir/recolher da árvore, guardado por workspace no localStorage. */
const PREFIX = 'azuos-env:tree:';

function storageKey(wsId: string): string {
  return `${PREFIX}${wsId}`;
}

export function readExpanded(wsId: string): string[] {
  try {
    const raw = window.localStorage.getItem(storageKey(wsId));
    const parsed: unknown = raw ? JSON.parse(raw) : null;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

export function writeExpanded(wsId: string, ids: string[]): void {
  try {
    window.localStorage.setItem(storageKey(wsId), JSON.stringify(ids));
  } catch {
    // Sem localStorage (janela privada), a árvore só perde a memória.
  }
}

/** Liga/desliga um id, sem repetir e preservando a ordem de inserção. */
export function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

/** Acrescenta os ids que faltam; devolve o mesmo array quando nada muda. */
export function withIds(ids: string[], added: string[]): string[] {
  const missing = added.filter((id) => !ids.includes(id));

  return missing.length === 0 ? ids : [...ids, ...missing];
}
