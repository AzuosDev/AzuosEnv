import type { ClickAppKey, ClickApps, ClickAppsOverride } from '@/api/types';

/** Ordem em que os ClickApps aparecem na tela. */
export const CLICK_APP_KEYS: ClickAppKey[] = [
  'priority',
  'tags',
  'timeTracking',
  'estimates',
  'sprints',
  'customFields',
  'multipleLists',
  'customIds',
  'ai',
];

export const CLICK_APP_LABEL: Record<ClickAppKey, string> = {
  priority: 'Prioridade',
  tags: 'Etiquetas',
  timeTracking: 'Controle de tempo',
  estimates: 'Estimativas',
  sprints: 'Sprints',
  customFields: 'Campos personalizados',
  multipleLists: 'Tarefa em várias Lists',
  customIds: 'IDs personalizados',
  ai: 'IA',
};

export const CLICK_APP_DESCRIPTION: Record<ClickAppKey, string> = {
  priority: 'Bandeira de prioridade na tarefa e nas views.',
  tags: 'Etiquetas coloridas por workspace.',
  timeTracking: 'Cronômetro, lançamento manual e timesheets.',
  estimates: 'Estimativa de tempo e pontos na tarefa.',
  sprints: 'Pastas de sprint, velocidade e fechamento.',
  customFields: 'Campos criados por você nas Lists, Folders e Spaces.',
  multipleLists: 'A mesma tarefa em mais de uma List.',
  customIds: 'Prefixo do workspace no identificador da tarefa.',
  ai: 'Resumos, criação por texto e agentes da IA.',
};

/**
 * Valor que vale no Space: o override decide, o workspace é o padrão. Igual à
 * resolução do backend, que lê a chave do Space e cai no workspace.
 */
export function effectiveClickApp(
  key: ClickAppKey,
  workspace: ClickApps,
  override: ClickAppsOverride | undefined,
): boolean {
  const own = override?.[key];

  return own === undefined ? workspace[key] : own;
}

/** O Space só guarda o que foi decidido nele; herdar é apagar a chave. */
export function toggleOverride(
  override: ClickAppsOverride | undefined,
  key: ClickAppKey,
  value: boolean | 'inherit',
): ClickAppsOverride {
  const next: ClickAppsOverride = { ...override };

  if (value === 'inherit') {
    delete next[key];

    return next;
  }

  next[key] = value;

  return next;
}

/** Quantos ClickApps o Space decidiu por conta própria. */
export function overrideCount(override: ClickAppsOverride | undefined): number {
  return CLICK_APP_KEYS.filter((key) => override?.[key] !== undefined).length;
}
