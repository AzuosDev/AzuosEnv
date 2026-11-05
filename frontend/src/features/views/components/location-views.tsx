import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { queryKeys } from '@/api/keys';
import type { EffectiveStatus, ViewLocationType, WorkspaceRole } from '@/api/types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Spinner } from '@/components/ui/spinner';
import { useSession } from '@/features/auth/session';
import { membersQuery } from '@/features/settings/api';
import { listStatusesQuery, tagsQuery, tasksInfiniteQuery } from '@/features/tasks/api';
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
import { isSupportedViewType } from '../view-kinds';
import { viewsQuery } from '../api';
import { ViewsBar } from './views-bar';
import { ViewToolbar } from './view-toolbar';

export interface LocationViewsProps {
  wsId: string;
  /** Local das views; na F6 é sempre a List aberta. */
  locationType: ViewLocationType;
  listId: string;
  spaceId: string;
  role: WorkspaceRole;
}

const SEARCH_DEBOUNCE_MS = 350;

/** Listas vazias estáveis: trocar de identidade a cada render refaria a consulta. */
const NO_STATUSES: EffectiveStatus[] = [];

/**
 * Views salvas do local com a toolbar e a view aberta (Lista ou Quadro). É quem
 * monta a consulta a partir da config e distribui dados e ações para as views.
 */
export function LocationViews({ wsId, locationType, listId, spaceId, role }: LocationViewsProps) {
  const user = useSession();
  const views = useQuery(viewsQuery(wsId, locationType, listId));
  const statuses = useQuery(listStatusesQuery(wsId, listId));
  const members = useQuery(membersQuery(wsId));
  const tags = useQuery(tagsQuery(wsId, spaceId));
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
  const groupBy = config.groupBy ?? 'status';
  const params = useMemo(
    () =>
      toQueryParams(config, { location: 'list', locationId: listId, search: debounced, groupBy }),
    [config, debounced, groupBy, listId],
  );
  const queryKey = queryKeys.tasks(wsId, params);
  const wanted = useRef<string | undefined>(undefined);
  const tasks = useInfiniteQuery({
    ...tasksInfiniteQuery(wsId, params, () => wanted.current),
    enabled: type !== null,
  });
  const statusList = statuses.data?.statuses ?? NO_STATUSES;
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
    statuses: statusList,
    members: members.data ?? [],
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

  const empty = groups.every((group) => group.items.length === 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ViewsBar
        views={items}
        activeId={active?.id ?? null}
        onPick={setPickedId}
        actions={viewActions}
        userId={user?.id}
      />

      {active ? (
        <ViewToolbar
          config={config}
          update={update}
          canEdit={canEdit}
          search={search}
          onSearch={setSearch}
          statuses={surface.statuses}
          members={surface.members}
          tags={tags.data ?? []}
        />
      ) : null}

      {type === null ? (
        <div className="px-4 pb-8 md:px-6">
          <EmptyState
            title="Essa view chega em outra etapa"
            description="Por enquanto o local abre em Lista e Quadro; Calendário, Tabela, Gantt e Workload vêm depois."
          />
        </div>
      ) : null}

      {type !== null && tasks.isPending ? (
        <div className="px-4 py-8 md:px-6">
          <Spinner label="Carregando as tarefas" />
        </div>
      ) : null}

      {type !== null && !tasks.isPending && empty ? (
        <div className="px-4 pb-8 md:px-6">
          <EmptyState
            title="Nenhuma tarefa por aqui"
            description="Crie a primeira tarefa desta List ou tire algum filtro da view."
            action={<QuickAdd groupKey={null} surface={surface} label="+ Criar primeira tarefa" />}
          />
        </div>
      ) : null}

      {type === 'list' && !tasks.isPending && !empty ? <ListView {...surface} /> : null}
      {type === 'board' && !tasks.isPending && !empty ? <BoardView {...surface} /> : null}

      {tasks.isError ? (
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

      <BulkBar
        surface={surface}
        onClear={() => {
          setSelected(new Set());
        }}
      />
    </div>
  );
}
