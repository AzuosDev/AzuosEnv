import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { AlertTriangle, Link2, Plus, X } from 'lucide-react';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { StatusGroup, TaskDetail } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { StatusPill } from '@/components/ui/status-pill';
import { toast } from '@/components/ui/toast';
import { taskQuery } from '../api';
import { createDependency, deleteDependency, dependenciesQuery } from '../collaboration-api';
import {
  DEPENDENCY_GROUP_HINT,
  DEPENDENCY_GROUP_LABEL,
  DEPENDENCY_GROUP_ORDER,
  DEPENDENCY_GROUP_TYPE,
  blockingRefs,
  dependencyTaskIds,
  groupDependencies,
  isSettled,
  type DependencyGroupKey,
} from '../dependency-model';
import { TaskSearchPicker } from './task-search-picker';

export interface DependenciesSectionProps {
  wsId: string;
  taskId: string;
  customId: string;
  /** Falso quando o papel não permite editar a tarefa. */
  canWrite: boolean;
}

/**
 * Dependências da tarefa nos três sentidos (aguardando, bloqueando e
 * vinculada), com busca de tarefa e aviso quando a tarefa está bloqueada.
 */
export function DependenciesSection({
  wsId,
  taskId,
  customId,
  canWrite,
}: DependenciesSectionProps) {
  const queryClient = useQueryClient();
  const rows = useQuery(dependenciesQuery(wsId, customId));
  const groups = groupDependencies(rows.data ?? [], taskId);
  const ids = dependencyTaskIds(groups);
  const others = useQueries({
    queries: ids.map((id) => ({ ...taskQuery(wsId, id), staleTime: 30_000 })),
  });
  const byId = new Map<string, TaskDetail>();

  others.forEach((result, index) => {
    const id = ids[index];

    if (id && result.data) {
      byId.set(id, result.data);
    }
  });

  const statusOf = (id: string): StatusGroup | undefined => byId.get(id)?.statusGroup;
  const blocked = blockingRefs(groups, statusOf);

  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.dependencies(wsId, customId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.taskActivity(wsId, customId) });
  };

  const onError = (error: unknown): void => {
    toast.error(errorMessage(error));
  };

  const add = useMutation({
    mutationFn: ({ group, dependsOnId }: { group: DependencyGroupKey; dependsOnId: string }) =>
      createDependency(wsId, customId, {
        dependsOnId,
        type: DEPENDENCY_GROUP_TYPE[group],
      }),
    onSuccess: () => {
      refresh();
      toast.success('Dependência criada.');
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (dependencyId: string) => deleteDependency(wsId, dependencyId),
    onSuccess: () => {
      refresh();
    },
    onError,
  });

  return (
    <section aria-labelledby="task-dependencies-heading" className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-muted" aria-hidden="true" />
        <h2 id="task-dependencies-heading" className="text-[12.5px] font-semibold text-muted">
          Dependências
        </h2>
        {blocked.length > 0 ? <StatusPill tone="warning">Bloqueada</StatusPill> : null}
      </div>

      {blocked.length > 0 ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/15 px-3 py-2 text-[12.5px] text-warning"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Esta tarefa está bloqueada: {String(blocked.length)}{' '}
            {blocked.length === 1 ? 'tarefa que ela aguarda' : 'tarefas que ela aguarda'} ainda não
            terminaram.
          </span>
        </p>
      ) : null}

      {rows.isPending ? <Spinner label="Carregando as dependências" /> : null}

      {DEPENDENCY_GROUP_ORDER.map((group) => {
        const refs = groups[group];

        return (
          <div key={group} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12.5px] font-medium text-body">
                {DEPENDENCY_GROUP_LABEL[group]}
                <span className="pl-1.5 text-[12px] text-muted">{refs.length}</span>
              </span>

              {canWrite ? (
                <TaskSearchPicker
                  wsId={wsId}
                  excludeIds={[taskId, ...refs.map((ref) => ref.otherTaskId)]}
                  label={`Buscar tarefa para ${DEPENDENCY_GROUP_LABEL[group]}`}
                  onPick={(task) => {
                    add.mutate({ group, dependsOnId: task.id });
                  }}
                >
                  <Button
                    variant="nav"
                    size="sm"
                    aria-label={`Adicionar em ${DEPENDENCY_GROUP_LABEL[group]}`}
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    Adicionar
                  </Button>
                </TaskSearchPicker>
              ) : null}
            </div>

            {refs.length === 0 ? (
              <p className="text-[12.5px] text-muted">{DEPENDENCY_GROUP_HINT[group]}</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {refs.map((ref) => {
                  const other = byId.get(ref.otherTaskId);
                  const settled = isSettled(other?.statusGroup);

                  return (
                    <li
                      key={ref.dependency.id}
                      className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl border border-line bg-surface px-2.5 md:min-h-10"
                    >
                      <StatusPill tone={settled ? 'success' : 'neutral'}>
                        {settled ? 'Pronta' : 'Aberta'}
                      </StatusPill>

                      {other ? (
                        <Link
                          to="/w/$wsId/t/$customId"
                          params={{ wsId, customId: other.customId }}
                          className="min-w-0 flex-1 truncate text-[13px] text-ink hover:underline"
                        >
                          <span className="pr-1.5 text-[12px] text-muted">{other.customId}</span>
                          {other.name}
                        </Link>
                      ) : (
                        <span className="min-w-0 flex-1 truncate text-[13px] text-muted">
                          Tarefa sem acesso
                        </span>
                      )}

                      {canWrite ? (
                        <Button
                          variant="nav"
                          size="icon"
                          aria-label={`Remover dependência de ${other?.customId ?? 'tarefa'}`}
                          className="h-11 w-11 shrink-0 md:h-9 md:w-9"
                          disabled={remove.isPending}
                          onClick={() => {
                            remove.mutate(ref.dependency.id);
                          }}
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </section>
  );
}
