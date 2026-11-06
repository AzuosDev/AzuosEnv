import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { queryKeys } from '@/api/keys';
import type { CustomField, EffectiveStatus, ViewLocationType, WorkspaceRole } from '@/api/types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Spinner } from '@/components/ui/spinner';
import { useSession } from '@/features/auth/session';
import { membersQuery } from '@/features/settings/api';
import { listStatusesQuery, tagsQuery, tasksInfiniteQuery } from '@/features/tasks/api';
import { fieldColumnsOf } from '@/features/tasks/field-values';
import { customFieldsQuery } from '@/features/tasks/fields-api';
import { BoardView } from '@/features/tasks/components/board-view';
import { BulkBar } from '@/features/tasks/components/bulk-bar';
import { ListView } from '@/features/tasks/components/list-view';
import { QuickAdd } from '@/features/tasks/components/quick-add';
import type { ViewSurfaceProps } from '@/features/tasks/components/view-surface';
import { useTaskActions } from '@/features/tasks/hooks/use-task-actions';
import { fillStatusGroups, mergePages, planTaskDrop } from '@/features/tasks/task-model';
import { toQueryParams } from '../filters';
import { useViewActions } from '../hooks/use-view-actions';
import { useViewConfig } from '../hooks/use-view-config';
import {
  groupByOf,
  isSupportedViewType,
  pageSizeOf,
  usesSelection,
  usesTasks,
} from '../view-kinds';
import { viewsQuery } from '../api';
import { ActivityView } from './activity-view';
import { CalendarView } from './calendar-view';
import { GanttView } from './gantt-view';
import { TableView } from './table-view';
import { TeamView } from './team-view';
import { TimelineView } from './timeline-view';
import { ViewsBar } from './views-bar';
import { ViewToolbar } from './view-toolbar';
import { WorkloadView } from './workload-view';

export interface LocationViewsProps {
  wsId: string;
  /** Local das views; na F9 é sempre a List aberta. */
  locationType: ViewLocationType;
  listId: string;
  spaceId: string;
  role: WorkspaceRole;
}

const SEARCH_DEBOUNCE_MS = 350;

/** Listas vazias estáveis: trocar de identidade a cada render refaria a consulta. */
const NO_STATUSES: EffectiveStatus[] = [];
const NO_FIELDS: CustomField[] = [];

/** Views em que o estado vazio substitui o desenho da view. */
const EMPTY_STATE_TYPES = ['list', 'board', 'table'];

/**
 * Views salvas do local com a toolbar e a view aberta. É quem monta a consulta a
 * partir da config e distribui dados e ações para a view do tipo escolhido.
 */
export function LocationViews({ wsId, locationType, listId, spaceId, role }: LocationViewsProps) {
  const user = useSession();
  const views = useQuery(viewsQuery(wsId, locationType, listId));
  const statuses = useQuery(listStatusesQuery(wsId, listId));
  const members = useQuery(membersQuery(wsId));
  const tags = useQuery(tagsQuery(wsId, spaceId));
  const fields = useQuery(customFieldsQuery(wsId, 'list', listId));
  const viewActions = useViewActions({ wsId, locationType, locationId: listId });

  const items = views.data ?? [];
  const [pickedId, setPickedId] = useState<string | null>(null);
  const fallback = items.find((view) => view.isDefault) ?? items[0] ?? null;
  const active = items.find((view) => view.id === pickedId) ?? fallback;
  const { config, update, canEdit } = useViewConfig({
    wsId,
    view: active,
    locationType,
    locationId: listId,
    userId: user?.id,
  });

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [search]);

  const type = active && isSupportedViewType(active.type) ? active.type : null;
  const groupBy = type ? groupByOf(type, config.groupBy) : 'status';
  const params = useMemo(
    () =>
      toQueryParams(config, {
        location: 'list',
        locationId: listId,
        search: debounced,
        groupBy,
        limit: type ? pageSizeOf(type) : undefined,
      }),
    [config, debounced, groupBy, listId, type],
  );
  const queryKey = queryKeys.tasks(wsId, params);
  const wanted = useRef<string | undefined>(undefined);
  const tasks = useInfiniteQuery({
    ...tasksInfiniteQuery(wsId, params, () => wanted.current),
    enabled: type !== null && usesTasks(type),
  });
  const statusList = statuses.data?.statuses ?? NO_STATUSES;
  const fieldList = fields.data ?? NO_FIELDS;
  const fieldColumns = useMemo(() => fieldColumnsOf(config, fieldList), [config, fieldList]);
  const groups = useMemo(() => {
    const merged = mergePages(tasks.data?.pages ?? []);

    return groupBy === 'status' ? fillStatusGroups(merged, statusList) : merged;
  }, [groupBy, statusList, tasks.data]);
  const actions = useTaskActions({ wsId, listId, queryKey, groupBy });

  // Trocar de view, de filtro ou de busca apaga a seleção.
  useEffect(() => {
    setSelected(new Set());
  }, [active?.id, params]);

  const surface: ViewSurfaceProps = {
    wsId,
    listId,
    location: 'list',
    locationId: listId,
    type: type ?? 'list',
    config,
    updateConfig: update,
    canEditConfig: canEdit,
    viewId: active?.id ?? null,
    statuses: statusList,
    members: members.data ?? [],
    fields: fieldList,
    tags: tags.data ?? [],
    fieldColumns,
    groups,
    groupBy,
    actions,
    canEdit: role !== 'guest',
    selected,
    onToggleSelect: (taskId) => {
      setSelected((current) => {
        const next = new Set(current);

        if (next.has(taskId)) {
          next.delete(taskId);
        } else {
          next.add(taskId);
        }

        return next;
      });
    },
    onDrop: (activeId, overId) => {
      const plan = planTaskDrop(groups, activeId, overId);

      if (plan) {
        actions.move.mutate({ plan });
      }
    },
    onLoadMore: (cursor) => {
      wanted.current = cursor;
      void tasks.fetchNextPage();
    },
    loadingMore: tasks.isFetchingNextPage,
  };

  if (views.isPending) {
    return (
      <div className="px-4 py-8 md:px-6">
        <Spinner label="Carregando as views" />
      </div>
    );
  }

  const reads = type !== null && usesTasks(type);
  const empty = groups.every((group) => group.items.length === 0);
  const showEmptyState = reads && empty && EMPTY_STATE_TYPES.includes(type ?? '');
  const ready = reads && !tasks.isPending && !showEmptyState;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ViewsBar
        views={items}
        activeId={active?.id ?? null}
        onPick={setPickedId}
        actions={viewActions}
        userId={user?.id}
      />

      {/* A Activity não lê o /tasks/query: busca, filtros e ordem não valem lá. */}
      {active && type !== null && usesTasks(type) ? (
        <ViewToolbar
          config={config}
          update={update}
          canEdit={canEdit}
          search={search}
          onSearch={setSearch}
          statuses={surface.statuses}
          members={surface.members}
          tags={surface.tags}
          fields={fieldList}
          type={type}
          groupBy={groupBy}
        />
      ) : null}

      {type === null ? (
        <div className="px-4 pb-8 md:px-6">
          <EmptyState
            title="Essa view chega em outra etapa"
            description="Formulário, Doc, Chat, Whiteboard, Dashboard, Mind Map, Embed e Mapa vêm nos módulos seguintes."
          />
        </div>
      ) : null}

      {reads && tasks.isPending ? (
        <div className="px-4 py-8 md:px-6">
          <Spinner label="Carregando as tarefas" />
        </div>
      ) : null}

      {showEmptyState && !tasks.isPending ? (
        <div className="px-4 pb-8 md:px-6">
          <EmptyState
            title="Nenhuma tarefa por aqui"
            description="Crie a primeira tarefa desta List ou tire algum filtro da view."
            action={<QuickAdd groupKey={null} surface={surface} label="+ Criar primeira tarefa" />}
          />
        </div>
      ) : null}

      {type === 'list' && ready ? <ListView {...surface} /> : null}
      {type === 'board' && ready ? <BoardView {...surface} /> : null}
      {type === 'calendar' && ready ? <CalendarView {...surface} /> : null}
      {type === 'table' && ready ? <TableView {...surface} /> : null}
      {type === 'gantt' && ready ? <GanttView {...surface} /> : null}
      {type === 'timeline' && ready ? <TimelineView {...surface} /> : null}
      {type === 'workload' && ready ? <WorkloadView {...surface} /> : null}
      {type === 'team' && ready ? <TeamView {...surface} /> : null}
      {type === 'activity' ? <ActivityView {...surface} /> : null}

      {reads && tasks.isError ? (
        <div className="px-4 pb-8 md:px-6">
          <EmptyState
            title="Não deu para carregar as tarefas"
            description="Tente de novo em instantes."
            action={
              <Button
                onClick={() => {
                  void tasks.refetch();
                }}
              >
                Tentar de novo
              </Button>
            }
          />
        </div>
      ) : null}

      {type !== null && usesSelection(type) ? (
        <BulkBar
          surface={surface}
          onClear={() => {
            setSelected(new Set());
          }}
        />
      ) : null}
    </div>
  );
}
