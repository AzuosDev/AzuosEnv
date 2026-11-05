import {
  CalendarDays,
  ChartColumn,
  CircleCheckBig,
  Clock,
  FileText,
  MessageSquare,
  Presentation,
  Settings,
  Sparkles,
  Target,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/**
 * Navegação global (rail de 64 px). `ready` marca o módulo já implementado; os
 * outros abrem a página "Em construção" até a etapa deles.
 */
export const NAV_ITEMS = [
  { id: 'tarefas', label: 'Tarefas', icon: CircleCheckBig, to: '/w/$wsId', ready: true },
  { id: 'planner', label: 'Planner', icon: CalendarDays, to: '/w/$wsId/planner', ready: false },
  { id: 'chat', label: 'Chat', icon: MessageSquare, to: '/w/$wsId/chat', ready: false },
  { id: 'docs', label: 'Docs', icon: FileText, to: '/w/$wsId/docs', ready: false },
  {
    id: 'dashboards',
    label: 'Dashboards',
    icon: ChartColumn,
    to: '/w/$wsId/dashboards',
    ready: false,
  },
  { id: 'metas', label: 'Metas', icon: Target, to: '/w/$wsId/metas', ready: false },
  { id: 'timesheets', label: 'Timesheets', icon: Clock, to: '/w/$wsId/timesheets', ready: false },
  { id: 'automacoes', label: 'Automações', icon: Zap, to: '/w/$wsId/automacoes', ready: false },
  {
    id: 'whiteboards',
    label: 'Whiteboards',
    icon: Presentation,
    to: '/w/$wsId/whiteboards',
    ready: false,
  },
  { id: 'ia', label: 'IA', icon: Sparkles, to: '/w/$wsId/ia', ready: false },
] as const;

/** Configurações mora no rodapé do rail, separada dos módulos. */
export const SETTINGS_ITEM = {
  id: 'configuracoes',
  label: 'Configurações',
  icon: Settings,
  to: '/w/$wsId/configuracoes',
  ready: false,
} as const;

export type NavItem = (typeof NAV_ITEMS)[number] | typeof SETTINGS_ITEM;
export type NavTarget = NavItem['to'];

/** Itens fixos da barra inferior abaixo de 768 px; o resto entra em "Mais". */
export const BOTTOM_NAV_IDS = ['tarefas', 'planner', 'chat', 'docs'] as const;

export const BOTTOM_NAV_ITEMS = NAV_ITEMS.filter((item) =>
  (BOTTOM_NAV_IDS as readonly string[]).includes(item.id),
);

export const MORE_NAV_ITEMS: NavItem[] = [
  ...NAV_ITEMS.filter((item) => !(BOTTOM_NAV_IDS as readonly string[]).includes(item.id)),
  SETTINGS_ITEM,
];

export type { LucideIcon };
