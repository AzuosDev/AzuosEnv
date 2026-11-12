import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '@/api/errors';
import type { CreateTargetInput, UpdateGoalInput } from '@/api/types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { useSession } from '@/features/auth/session';
import { ConfirmDialog } from '@/features/settings/components/confirm-dialog';
import { membersQuery } from '@/features/settings/api';
import { PageHeader } from '@/features/shell/components/page-header';
import { cn } from '@/lib/utils';
import { createTarget, deleteGoal, goalFoldersQuery, goalQuery, updateGoal } from '../api';
import { canWriteGoal, goalDueLabel, percentLabel, progressTone } from '../goal-model';
import { useGoalActions } from '../hooks/use-goal-actions';
import { GoalDialog } from './goal-dialog';
import { ownersLabel } from './goal-card';
import { TargetRow } from './target-row';
import { TargetDialog } from './target-dialog';

const TONE_TEXT: Record<string, string> = {
  success: 'text-success',
  accent: 'text-accent',
  warning: 'text-warning',
  danger: 'text-danger',
};

const TONE_BAR: Record<string, string> = {
  success: 'bg-success',
  accent: 'bg-accent',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

/** Detalhe da meta: alvos, progresso, edição e conclusão. */
export function GoalDetail({ wsId, goalId }: { wsId: string; goalId: string }) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const session = useSession();
  const goal = useQuery(goalQuery(wsId, goalId));
  const folders = useQuery(goalFoldersQuery(wsId));
  const members = useQuery(membersQuery(wsId));
  const actions = useGoalActions(wsId);
  const [targetOpen, setTargetOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  const newTarget = useMutation({
    mutationFn: (body: CreateTargetInput) => createTarget(wsId, goalId, body),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['workspaces', wsId, 'goals'] });
      toast.success('Alvo criado.');
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });

  const editGoal = useMutation({
    mutationFn: (body: UpdateGoalInput) => updateGoal(wsId, goalId, body),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['workspaces', wsId, 'goals'] });
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });

  const removeGoal = useMutation({
    mutationFn: () => deleteGoal(wsId, goalId),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['workspaces', wsId, 'goals'] });
      toast.success('Meta excluída.');
      await navigate({ to: '/w/$wsId/metas', params: { wsId } });
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });

  if (goal.isPending) {
    return (
      <div className="px-4 pt-5 md:px-6">
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (goal.isError || !goal.data) {
    return (
      <div className="px-4 pt-5 md:px-6">
        <EmptyState
          title="Meta não encontrada"
          description="Ela pode ter sido excluída ou é privada."
          action={
            <Button variant="outline" asChild>
              <Link to="/w/$wsId/metas" params={{ wsId }}>
                Voltar para as Metas
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  const view = goal.data;
  const canWrite = session ? canWriteGoal(view.goal, session.id) : false;
  const tone = progressTone(view.progress);
  const due = goalDueLabel(view.goal);

  return (
    <div className="flex min-w-0 flex-col gap-4 pb-10">
      <PageHeader
        wsId={wsId}
        title={view.goal.name}
        description={view.goal.description ?? undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/w/$wsId/metas" params={{ wsId }}>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Metas
              </Link>
            </Button>

            {canWrite ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditOpen(true);
                  }}
                >
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    editGoal.mutate({ completed: !view.goal.completedAt });
                  }}
                >
                  {view.goal.completedAt ? 'Reabrir meta' : 'Concluir meta'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Excluir meta"
                  onClick={() => {
                    setRemoveOpen(true);
                  }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setTargetOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Novo alvo
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      <div className="flex min-w-0 max-w-[900px] flex-col gap-4 px-4 md:px-6">
        <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="min-w-0 flex-1 text-[12.5px] text-muted">
              {ownersLabel(view, members.data ?? [])}
              {due ? ` · prazo ${due}` : ''}
              {view.goal.private ? ' · privada' : ''}
              {view.goal.completedAt ? ' · concluída' : ''}
            </span>
            <span className={cn('text-3xl font-semibold', TONE_TEXT[tone])}>
              {percentLabel(view.progress)}
            </span>
          </div>

          <div
            className="h-2 overflow-hidden rounded-full bg-surface-2"
            role="progressbar"
            aria-valuenow={Math.round(view.progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progresso de ${view.goal.name}`}
          >
            <div
              className={cn('h-2 rounded-full', TONE_BAR[tone])}
              style={{ width: `${String(Math.min(100, view.progress))}%` }}
            />
          </div>
        </section>

        <section aria-label="Alvos da meta" className="flex flex-col gap-2">
          <h2 className="text-[15px] font-semibold text-ink">Alvos</h2>

          {view.targets.length === 0 ? (
            <p className="text-[13px] text-muted">
              Sem alvos ainda. Um alvo pode ser um número, um valor em moeda, um sim/não ou as
              tarefas de uma List.
            </p>
          ) : (
            <div className="flex flex-col">
              {view.targets.map((target) => (
                <TargetRow
                  key={target.id}
                  target={target}
                  wsId={wsId}
                  canWrite={canWrite}
                  onValue={(item, current) => {
                    void actions.setTargetValue(goalId, item, current);
                  }}
                  onRemove={(item) => {
                    void actions.removeTarget(goalId, item.id);
                  }}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <TargetDialog
        wsId={wsId}
        open={targetOpen}
        onOpenChange={setTargetOpen}
        onCreate={(body) => {
          newTarget.mutate(body);
        }}
      />

      <GoalDialog
        wsId={wsId}
        open={editOpen}
        onOpenChange={setEditOpen}
        folders={folders.data ?? []}
        view={view}
        onCreate={() => undefined}
        onUpdate={(_goalId, body) => {
          editGoal.mutate(body);
        }}
      />

      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title="Excluir a meta?"
        description="Os alvos dela saem junto. A ação não se desfaz."
        confirmLabel="Excluir"
        danger
        pending={removeGoal.isPending}
        onConfirm={() => {
          removeGoal.mutate();
        }}
      />
    </div>
  );
}
