import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { GoalTarget, GoalView, UpdateTargetInput } from '@/api/types';
import { toast } from '@/components/ui/toast';
import { deleteTarget, updateTarget } from '../api';
import { goalPercent } from '../goal-model';

export interface GoalActions {
  /** Grava o valor do alvo e repinta o progresso da meta na hora. */
  setTargetValue: (goalId: string, target: GoalTarget, current: number) => Promise<void>;
  patchTarget: (goalId: string, targetId: string, body: UpdateTargetInput) => Promise<void>;
  removeTarget: (goalId: string, targetId: string) => Promise<void>;
  refresh: () => void;
}

/** Escritas de alvo compartilhadas pelo hub e pelo detalhe da meta. */
export function useGoalActions(wsId: string): GoalActions {
  const client = useQueryClient();

  const refresh = useCallback((): void => {
    void client.invalidateQueries({ queryKey: ['workspaces', wsId, 'goals'] });
  }, [client, wsId]);

  /** Mesmo remendo nas duas caches: a lista de metas e o detalhe. */
  const paint = useCallback(
    (goalId: string, next: (view: GoalView) => GoalView): void => {
      const apply = (view: GoalView | undefined): GoalView | undefined =>
        view && view.goal.id === goalId ? next(view) : view;

      client.setQueriesData<GoalView[]>({ queryKey: ['workspaces', wsId, 'goals'] }, (views) =>
        Array.isArray(views) ? views.map((view) => apply(view) ?? view) : views,
      );
      client.setQueryData<GoalView>(queryKeys.goal(wsId, goalId), apply);
    },
    [client, wsId],
  );

  const withTargets = useCallback(
    (targets: GoalTarget[]): Pick<GoalView, 'targets' | 'progress'> => ({
      targets,
      progress: goalPercent(targets),
    }),
    [],
  );

  const setTargetValue = useCallback(
    async (goalId: string, target: GoalTarget, current: number): Promise<void> => {
      paint(goalId, (view) => ({
        ...view,
        ...withTargets(
          view.targets.map((item) => (item.id === target.id ? { ...item, current } : item)),
        ),
      }));

      try {
        const result = await updateTarget(wsId, goalId, target.id, { current });

        paint(goalId, (view) => ({
          ...view,
          ...withTargets(
            view.targets.map((item) => (item.id === target.id ? result.target : item)),
          ),
        }));
      } catch (error) {
        toast.error(errorMessage(error));
      }

      refresh();
    },
    [paint, refresh, withTargets, wsId],
  );

  const patchTarget = useCallback(
    async (goalId: string, targetId: string, body: UpdateTargetInput): Promise<void> => {
      try {
        const result = await updateTarget(wsId, goalId, targetId, body);

        paint(goalId, (view) => ({
          ...view,
          ...withTargets(view.targets.map((item) => (item.id === targetId ? result.target : item))),
        }));
      } catch (error) {
        toast.error(errorMessage(error));
      }

      refresh();
    },
    [paint, refresh, withTargets, wsId],
  );

  const removeTarget = useCallback(
    async (goalId: string, targetId: string): Promise<void> => {
      try {
        await deleteTarget(wsId, goalId, targetId);
        paint(goalId, (view) => ({
          ...view,
          ...withTargets(view.targets.filter((item) => item.id !== targetId)),
        }));
      } catch (error) {
        toast.error(errorMessage(error));
      }

      refresh();
    },
    [paint, refresh, withTargets, wsId],
  );

  return { setTargetValue, patchTarget, removeTarget, refresh };
}
