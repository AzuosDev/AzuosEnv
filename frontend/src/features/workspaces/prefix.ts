/**
 * Prefixo sugerido para as tarefas a partir do nome do workspace: iniciais das
 * palavras (AZD para "Azuos Dev") e, quando sobra só uma palavra, as suas
 * primeiras letras. Devolve string vazia quando não dá para sugerir.
 */
export function suggestTaskPrefix(name: string): string {
  const words = name
    .trim()
    .toUpperCase()
    .split(/\s+/)
    .map((word) => word.replace(/[^A-Z0-9]/g, ''))
    .filter(Boolean);

  const first = words[0];

  if (!first) {
    return '';
  }

  const initials = words.map((word) => word.charAt(0)).join('');

  if (initials.length >= 2) {
    return initials.slice(0, 6);
  }

  return first.slice(0, 3);
}

/** Cores do workspace, sempre vindas dos tokens da Azuos. */
export const WORKSPACE_COLORS = [
  { value: '#A78BFA', label: 'Violeta', swatch: 'bg-accent' },
  { value: '#60A5FA', label: 'Azul', swatch: 'bg-info' },
  { value: '#22C55E', label: 'Verde', swatch: 'bg-success' },
  { value: '#F59E0B', label: 'Âmbar', swatch: 'bg-warning' },
  { value: '#EF4444', label: 'Vermelho', swatch: 'bg-danger' },
] as const;

export const DEFAULT_WORKSPACE_COLOR = WORKSPACE_COLORS[0].value;
