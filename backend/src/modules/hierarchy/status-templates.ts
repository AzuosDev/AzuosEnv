export const STATUS_GROUPS = ['notStarted', 'active', 'done', 'closed'] as const;
export type StatusGroup = (typeof STATUS_GROUPS)[number];

export const STATUS_TEMPLATES = ['dev', 'comercial', 'simples'] as const;
export type StatusTemplate = (typeof STATUS_TEMPLATES)[number];

export const DEFAULT_STATUS_TEMPLATE: StatusTemplate = 'dev';

export interface StatusTemplateEntry {
  name: string;
  color: string;
  group: StatusGroup;
}

export interface StatusTemplatePreset {
  name: string;
  statuses: StatusTemplateEntry[];
}

/** Status sets offered when a Space is created. */
export const STATUS_TEMPLATE_PRESETS: Record<StatusTemplate, StatusTemplatePreset> = {
  dev: {
    name: 'Dev Azuos',
    statuses: [
      { name: 'Backlog', color: '#64748B', group: 'notStarted' },
      { name: 'A fazer', color: '#94A3B8', group: 'notStarted' },
      { name: 'Em andamento', color: '#2563EB', group: 'active' },
      { name: 'Code review', color: '#7C3AED', group: 'active' },
      { name: 'Teste', color: '#F59E0B', group: 'active' },
      { name: 'Homologação cliente', color: '#0EA5E9', group: 'active' },
      { name: 'Deploy', color: '#14B8A6', group: 'active' },
      { name: 'Concluído', color: '#16A34A', group: 'done' },
      { name: 'Bloqueado', color: '#DC2626', group: 'active' },
    ],
  },
  comercial: {
    name: 'Comercial',
    statuses: [
      { name: 'Lead', color: '#64748B', group: 'notStarted' },
      { name: 'Reunião', color: '#2563EB', group: 'active' },
      { name: 'Proposta enviada', color: '#0EA5E9', group: 'active' },
      { name: 'Negociação', color: '#F59E0B', group: 'active' },
      { name: 'Fechado', color: '#16A34A', group: 'done' },
      { name: 'Perdido', color: '#DC2626', group: 'closed' },
    ],
  },
  simples: {
    name: 'Simples',
    statuses: [
      { name: 'A fazer', color: '#94A3B8', group: 'notStarted' },
      { name: 'Em andamento', color: '#2563EB', group: 'active' },
      { name: 'Concluído', color: '#16A34A', group: 'done' },
    ],
  },
};
