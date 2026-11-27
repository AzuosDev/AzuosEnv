import type { WorkspaceRole } from '@/api/types';
import { canAdmin } from './roles';

export type SettingsGroup = 'pessoal' | 'workspace' | 'avancado';

export type SettingsPath =
  | '/w/$wsId/configuracoes/perfil'
  | '/w/$wsId/configuracoes/preferencias'
  | '/w/$wsId/configuracoes/notificacoes'
  | '/w/$wsId/configuracoes/seguranca'
  | '/w/$wsId/configuracoes/workspace'
  | '/w/$wsId/configuracoes/pessoas'
  | '/w/$wsId/configuracoes/equipes'
  | '/w/$wsId/configuracoes/recursos'
  | '/w/$wsId/configuracoes/campos'
  | '/w/$wsId/configuracoes/integracoes'
  | '/w/$wsId/configuracoes/webhooks'
  | '/w/$wsId/configuracoes/chaves'
  | '/w/$wsId/configuracoes/auditoria'
  | '/w/$wsId/configuracoes/dados';

/** Uma tela de configuração. O id é o último segmento da rota. */
export interface SettingsTab {
  id: string;
  label: string;
  description: string;
  /** Some para member, limited e guest. */
  adminOnly: boolean;
  to: SettingsPath;
}

/** Um item da navegação lateral; abre a primeira aba visível. */
export interface SettingsSection {
  id: string;
  label: string;
  description: string;
  group: SettingsGroup;
  tabs: SettingsTab[];
}

export const GROUP_LABELS: Record<SettingsGroup, string> = {
  pessoal: 'Pessoal',
  workspace: 'Workspace',
  avancado: 'Avançado',
};

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: 'conta',
    label: 'Minha conta',
    description: 'Seus dados, a aparência do app e o acesso.',
    group: 'pessoal',
    tabs: [
      {
        id: 'perfil',
        label: 'Perfil',
        description: 'Nome, avatar, fuso horário e idioma da sua conta.',
        adminOnly: false,
        to: '/w/$wsId/configuracoes/perfil',
      },
      {
        id: 'preferencias',
        label: 'Preferências',
        description: 'Tema da interface, salvo na sua conta.',
        adminOnly: false,
        to: '/w/$wsId/configuracoes/preferencias',
      },
      {
        id: 'seguranca',
        label: 'Segurança',
        description: 'Senha e sessões ativas.',
        adminOnly: false,
        to: '/w/$wsId/configuracoes/seguranca',
      },
    ],
  },
  {
    id: 'notificacoes',
    label: 'Notificações',
    description: 'Onde cada tipo de aviso chega.',
    group: 'pessoal',
    tabs: [
      {
        id: 'notificacoes',
        label: 'Notificações',
        description: 'Onde cada tipo de aviso chega.',
        adminOnly: false,
        to: '/w/$wsId/configuracoes/notificacoes',
      },
    ],
  },
  {
    id: 'workspace',
    label: 'Workspace',
    description: 'Identidade, recursos ligados e campos deste workspace.',
    group: 'workspace',
    tabs: [
      {
        id: 'workspace',
        label: 'Geral',
        description: 'Nome, cor e prefixo das tarefas.',
        adminOnly: true,
        to: '/w/$wsId/configuracoes/workspace',
      },
      {
        id: 'recursos',
        label: 'Recursos',
        description: 'Ligue e desligue recursos no workspace e em cada Space.',
        adminOnly: true,
        to: '/w/$wsId/configuracoes/recursos',
      },
      {
        id: 'campos',
        label: 'Campos personalizados',
        description: 'Todos os campos criados e onde cada um vale.',
        adminOnly: true,
        to: '/w/$wsId/configuracoes/campos',
      },
    ],
  },
  {
    id: 'pessoas',
    label: 'Pessoas',
    description: 'Quem participa do workspace e como está organizado.',
    group: 'workspace',
    tabs: [
      {
        id: 'pessoas',
        label: 'Membros',
        description: 'Convites, papéis e acesso ao workspace.',
        adminOnly: true,
        to: '/w/$wsId/configuracoes/pessoas',
      },
      {
        id: 'equipes',
        label: 'Equipes',
        description: 'Grupos de pessoas do workspace.',
        adminOnly: false,
        to: '/w/$wsId/configuracoes/equipes',
      },
    ],
  },
  {
    id: 'integracoes',
    label: 'Integrações',
    description: 'Tudo o que liga o Azuos Env a outros sistemas.',
    group: 'avancado',
    tabs: [
      {
        id: 'integracoes',
        label: 'Aplicativos',
        description: 'GitHub e Google Agenda.',
        adminOnly: true,
        to: '/w/$wsId/configuracoes/integracoes',
      },
      {
        id: 'webhooks',
        label: 'Webhooks',
        description: 'Avisos que o Azuos Env manda para fora, com o log de entregas.',
        adminOnly: true,
        to: '/w/$wsId/configuracoes/webhooks',
      },
      {
        id: 'chaves',
        label: 'Chaves de API',
        description: 'Chaves pessoais para falar com a API.',
        adminOnly: true,
        to: '/w/$wsId/configuracoes/chaves',
      },
    ],
  },
  {
    id: 'dados',
    label: 'Dados',
    description: 'Importação, exportação e o registro do que foi feito.',
    group: 'avancado',
    tabs: [
      {
        id: 'dados',
        label: 'Importar e exportar',
        description: 'Trazer do ClickUp por CSV e baixar o workspace em JSON.',
        adminOnly: true,
        to: '/w/$wsId/configuracoes/dados',
      },
      {
        id: 'auditoria',
        label: 'Auditoria',
        description: 'Tudo o que a administração do workspace fez.',
        adminOnly: true,
        to: '/w/$wsId/configuracoes/auditoria',
      },
    ],
  },
];

/** Abas da seção que o papel pode abrir. */
export function visibleTabs(section: SettingsSection, role: WorkspaceRole): SettingsTab[] {
  return canAdmin(role) ? section.tabs : section.tabs.filter((tab) => !tab.adminOnly);
}

/** Seções que o papel pode abrir, já sem as abas que ele não vê. */
export function visibleSections(role: WorkspaceRole): SettingsSection[] {
  return SETTINGS_SECTIONS.map((section) => ({
    ...section,
    tabs: visibleTabs(section, role),
  })).filter((section) => section.tabs.length > 0);
}

/**
 * Nome do item na navegação e no título. Seção que sobrou com uma aba só fala
 * pela aba — para um member, "Pessoas" com nada além de Equipes seria promessa
 * falsa.
 */
export function sectionLabel(section: SettingsSection): string {
  const [first] = section.tabs;

  return section.tabs.length === 1 && first ? first.label : section.label;
}

/** Para onde o item da navegação leva: a primeira aba visível. */
export function sectionTarget(section: SettingsSection): SettingsPath {
  const [first] = section.tabs;

  if (!first) {
    throw new Error(`Seção ${section.id} sem abas visíveis.`);
  }

  return first.to;
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

export interface ActiveSettings {
  /** Seção aberta, com as abas que este papel vê. */
  section: SettingsSection;
  tab: SettingsTab;
}

/** Seção e aba abertas agora; null na própria /configuracoes e fora dela. */
export function activeSettings(
  pathname: string,
  wsId: string,
  role: WorkspaceRole,
): ActiveSettings | null {
  const prefix = `/w/${wsId}/configuracoes/`;

  if (!pathname.startsWith(prefix)) {
    return null;
  }

  const id = pathname.slice(prefix.length).split('/')[0];

  for (const section of visibleSections(role)) {
    const tab = section.tabs.find((item) => item.id === id);

    if (tab) {
      return { section, tab };
    }
  }

  return null;
}
