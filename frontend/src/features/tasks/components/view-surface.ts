import type {
  CustomField,
  EffectiveStatus,
  Tag,
  TaskLocation,
  ViewConfig,
  ViewGroupBy,
  WorkspaceMemberItem,
} from '@/api/types';
import type { SupportedViewType } from '@/features/views/view-kinds';
import type { useTaskActions } from '../hooks/use-task-actions';
import type { TaskGroupState } from '../task-model';

/**
 * O que cada view recebe para desenhar as tarefas: dados do local, escritas,
 * seleção e arrasto. Todas as views usam o mesmo contrato.
 */
export interface ViewSurfaceProps {
  wsId: string;
  listId: string;
  /** Escopo da view; na F9 é sempre a List aberta. */
  location: TaskLocation;
  locationId: string;
  /** Tipo da view aberta: cada uma lê as opções que são suas. */
  type: SupportedViewType;
  /** Config da view, para as opções próprias de cada tipo (escala, métrica…). */
  config: ViewConfig;
  updateConfig: (patch: (config: ViewConfig) => ViewConfig) => void;
  /** Falso em view protegida de outra pessoa: a config fica só leitura. */
  canEditConfig: boolean;
  /** Id da view aberta; null quando o local não tem nenhuma. */
  viewId: string | null;
  statuses: EffectiveStatus[];
  members: WorkspaceMemberItem[];
  /** Campos personalizados do local. */
  fields: CustomField[];
  /** Tags do Space do local. */
  tags: Tag[];
  /** Campos personalizados escolhidos como coluna da Lista. */
  fieldColumns: CustomField[];
  groups: TaskGroupState[];
  groupBy: ViewGroupBy;
  actions: ReturnType<typeof useTaskActions>;
  /** Falso quando o papel do usuário não permite editar o local. */
  canEdit: boolean;
  selected: Set<string>;
  onToggleSelect: (taskId: string) => void;
  onDrop: (activeId: string, overId: string) => void;
  onLoadMore: (cursor: string) => void;
  loadingMore: boolean;
}
