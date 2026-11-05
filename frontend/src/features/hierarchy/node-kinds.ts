import {
  Book,
  Briefcase,
  Code,
  Folder as FolderIcon,
  Headphones,
  Megaphone,
  Rocket,
  Target,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { PermissionLevel, StatusGroup, StatusTemplate, TrashEntityType } from '@/api/types';
import type { TreeNodeKind } from '@/features/shell/tree-path';

export const NODE_LABEL: Record<TreeNodeKind, string> = {
  space: 'Space',
  folder: 'Folder',
  list: 'List',
};

export const ENTITY_LABEL: Record<TrashEntityType, string> = {
  space: 'Space',
  folder: 'Folder',
  list: 'List',
  task: 'Tarefa',
};

/* Statuses -------------------------------------------------------------- */

export const STATUS_GROUP_ORDER: StatusGroup[] = ['notStarted', 'active', 'done', 'closed'];

export const STATUS_GROUP_LABEL: Record<StatusGroup, string> = {
  notStarted: 'Não iniciado',
  active: 'Ativo',
  done: 'Concluído',
  closed: 'Fechado',
};

export const STATUS_SOURCE_LABEL: Record<'list' | 'folder' | 'space', string> = {
  list: 'desta List',
  folder: 'do Folder',
  space: 'do Space',
};

export interface TemplateOption {
  value: StatusTemplate;
  label: string;
  description: string;
}

/** Os três templates que o backend oferece quando o Space é criado. */
export const STATUS_TEMPLATES: TemplateOption[] = [
  {
    value: 'dev',
    label: 'Dev',
    description: 'Backlog, A fazer, Em andamento, Code review, Teste, Homologação, Deploy…',
  },
  {
    value: 'comercial',
    label: 'Comercial',
    description: 'Lead, Reunião, Proposta enviada, Negociação, Fechado, Perdido.',
  },
  { value: 'simples', label: 'Simples', description: 'A fazer, Em andamento, Concluído.' },
];

/* Compartilhamento ------------------------------------------------------ */

export const PERMISSION_LEVELS: { value: PermissionLevel; label: string }[] = [
  { value: 'view', label: 'Ver' },
  { value: 'comment', label: 'Comentar' },
  { value: 'edit', label: 'Editar' },
  { value: 'full', label: 'Total' },
];

export const LEVEL_LABEL: Record<PermissionLevel, string> = {
  view: 'Ver',
  comment: 'Comentar',
  edit: 'Editar',
  full: 'Total',
};

/* Cores e ícones -------------------------------------------------------- */

/** Paleta oferecida ao usuário; cada hex cai num tom dos tokens (lib/colors). */
export const NODE_COLORS: { value: string; label: string }[] = [
  { value: '#2563EB', label: 'Azul' },
  { value: '#A78BFA', label: 'Violeta' },
  { value: '#16A34A', label: 'Verde' },
  { value: '#F59E0B', label: 'Âmbar' },
  { value: '#DC2626', label: 'Vermelho' },
  { value: '#0EA5E9', label: 'Ciano' },
];

export const NODE_ICONS: { value: string; label: string; Icon: LucideIcon }[] = [
  { value: 'folder', label: 'Pasta', Icon: FolderIcon },
  { value: 'users', label: 'Pessoas', Icon: Users },
  { value: 'code', label: 'Código', Icon: Code },
  { value: 'briefcase', label: 'Negócio', Icon: Briefcase },
  { value: 'megaphone', label: 'Marketing', Icon: Megaphone },
  { value: 'headphones', label: 'Suporte', Icon: Headphones },
  { value: 'rocket', label: 'Lançamento', Icon: Rocket },
  { value: 'target', label: 'Meta', Icon: Target },
  { value: 'book', label: 'Documentação', Icon: Book },
  { value: 'wrench', label: 'Manutenção', Icon: Wrench },
];

const ICON_BY_VALUE = new Map(NODE_ICONS.map((option) => [option.value, option.Icon]));

/** Componente do ícone escolhido; null quando o Space não tem ícone. */
export function iconOf(name: string | undefined): LucideIcon | null {
  return name ? (ICON_BY_VALUE.get(name) ?? null) : null;
}
