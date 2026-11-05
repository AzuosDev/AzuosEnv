import type { WorkspaceRole } from '@/api/types';
import { canAdmin } from './roles';

export type SettingsGroup = 'pessoal' | 'workspace';

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
    | '/w/$wsId/configuracoes/equipes';
}

export const GROUP_LABELS: Record<SettingsGroup, string> = {
  pessoal: 'Pessoal',
  workspace: 'Workspace',
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

  return (['pessoal', 'workspace'] as const)
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
