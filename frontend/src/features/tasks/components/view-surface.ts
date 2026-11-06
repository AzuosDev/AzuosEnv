import type { CustomField, EffectiveStatus, ViewGroupBy, WorkspaceMemberItem } from '@/api/types';
import type { useTaskActions } from '../hooks/use-task-actions';
import type { TaskGroupState } from '../task-model';

/**
 * O que a Lista e o Quadro recebem para desenhar as tarefas: dados do local,
 * escritas, seleção e arrasto. Os dois lados usam o mesmo contrato.
 */
export interface ViewSurfaceProps {
  wsId: string;
  listId: string;
  statuses: EffectiveStatus[];
  members: WorkspaceMemberItem[];
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
