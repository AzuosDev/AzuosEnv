import type { WorkspaceRole } from '@/api/types';
import { canAdmin } from './roles';

export type SettingsGroup = 'pessoal' | 'workspace' | 'avancado';

export interface SettingsSection {
  id: string;
  label: string;
  description: string;
  group: SettingsGroup;
  /** Some para member, limited e guest. */
  adminOnly: boolean;
  to:
    | '/w/$wsId/configuracoes/perfil'
    | '/w/$wsId/configuracoes/preferencias'
    | '/w/$wsId/configuracoes/notificacoes'
    | '/w/$wsId/configuracoes/seguranca'
    | '/w/$wsId/configuracoes/workspace'
    | '/w/$wsId/configuracoes/pessoas'
    | '/w/$wsId/configuracoes/equipes'
    | '/w/$wsId/configuracoes/clickapps'
    | '/w/$wsId/configuracoes/campos'
    | '/w/$wsId/configuracoes/integracoes'
    | '/w/$wsId/configuracoes/webhooks'
    | '/w/$wsId/configuracoes/chaves'
    | '/w/$wsId/configuracoes/auditoria'
    | '/w/$wsId/configuracoes/dados';
}

export const GROUP_LABELS: Record<SettingsGroup, string> = {
  pessoal: 'Pessoal',
  workspace: 'Workspace',
  avancado: 'Avançado',
};

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: 'perfil',
    label: 'Perfil',
    description: 'Nome, avatar, fuso horário e idioma da sua conta.',
    group: 'pessoal',
    adminOnly: false,
    to: '/w/$wsId/configuracoes/perfil',
  },
  {
    id: 'preferencias',
    label: 'Preferências',
    description: 'Tema da interface, salvo na sua conta.',
    group: 'pessoal',
    adminOnly: false,
    to: '/w/$wsId/configuracoes/preferencias',
  },
  {
    id: 'notificacoes',
    label: 'Notificações',
    description: 'Onde cada tipo de aviso chega.',
    group: 'pessoal',
    adminOnly: false,
    to: '/w/$wsId/configuracoes/notificacoes',
  },
  {
    id: 'seguranca',
    label: 'Segurança',
    description: 'Senha e sessões ativas.',
    group: 'pessoal',
    adminOnly: false,
    to: '/w/$wsId/configuracoes/seguranca',
  },
  {
    id: 'workspace',
    label: 'Workspace',
    description: 'Nome, cor e prefixo das tarefas.',
    group: 'workspace',
    adminOnly: true,
    to: '/w/$wsId/configuracoes/workspace',
  },
  {
    id: 'pessoas',
    label: 'Pessoas',
    description: 'Convites, papéis e acesso ao workspace.',
    group: 'workspace',
    adminOnly: true,
    to: '/w/$wsId/configuracoes/pessoas',
  },
  {
    id: 'equipes',
    label: 'Equipes',
    description: 'Grupos de pessoas do workspace.',
    group: 'workspace',
    adminOnly: false,
    to: '/w/$wsId/configuracoes/equipes',
  },
  {
    id: 'clickapps',
    label: 'ClickApps',
    description: 'Ligue e desligue recursos no workspace e em cada Space.',
    group: 'avancado',
    adminOnly: true,
    to: '/w/$wsId/configuracoes/clickapps',
  },
  {
    id: 'campos',
    label: 'Campos personalizados',
    description: 'Todos os campos criados e onde cada um vale.',
    group: 'avancado',
    adminOnly: true,
    to: '/w/$wsId/configuracoes/campos',
  },
  {
    id: 'integracoes',
    label: 'Integrações',
    description: 'GitHub e Google Agenda.',
    group: 'avancado',
    adminOnly: true,
    to: '/w/$wsId/configuracoes/integracoes',
  },
  {
    id: 'webhooks',
    label: 'Webhooks',
    description: 'Avisos que o Azuos Env manda para fora, com o log de entregas.',
    group: 'avancado',
    adminOnly: true,
    to: '/w/$wsId/configuracoes/webhooks',
  },
  {
    id: 'chaves',
    label: 'Chaves de API',
    description: 'Chaves pessoais para falar com a API.',
    group: 'avancado',
    adminOnly: true,
    to: '/w/$wsId/configuracoes/chaves',
  },
  {
    id: 'auditoria',
    label: 'Auditoria',
    description: 'Tudo o que a administração do workspace fez.',
    group: 'avancado',
    adminOnly: true,
    to: '/w/$wsId/configuracoes/auditoria',
  },
  {
    id: 'dados',
    label: 'Importar e exportar',
    description: 'Trazer do ClickUp por CSV e baixar o workspace em JSON.',
    group: 'avancado',
    adminOnly: true,
    to: '/w/$wsId/configuracoes/dados',
  },
];

/** Seções que o papel pode abrir. */
export function visibleSections(role: WorkspaceRole): SettingsSection[] {
  return canAdmin(role)
    ? SETTINGS_SECTIONS
    : SETTINGS_SECTIONS.filter((section) => !section.adminOnly);
}

/** Seções visíveis agrupadas, na ordem em que aparecem na navegação. */
export function groupedSections(
  role: WorkspaceRole,
): { group: SettingsGroup; items: SettingsSection[] }[] {
  const visible = visibleSections(role);

  return (['pessoal', 'workspace', 'avancado'] as const)
    .map((group) => ({ group, items: visible.filter((section) => section.group === group) }))
    .filter((entry) => entry.items.length > 0);
}

/** Seção aberta agora; null na própria /configuracoes. */
export function activeSection(pathname: string, wsId: string): SettingsSection | null {
  const prefix = `/w/${wsId}/configuracoes/`;

  if (!pathname.startsWith(prefix)) {
    return null;
  }

  const id = pathname.slice(prefix.length).split('/')[0];

  return SETTINGS_SECTIONS.find((section) => section.id === id) ?? null;
}
