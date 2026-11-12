import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Target } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '@/api/errors';
import type { CreateGoalInput, GoalFolder, UpdateGoalInput } from '@/api/types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { useSession } from '@/features/auth/session';
import { membersQuery } from '@/features/settings/api';
import { PageHeader } from '@/features/shell/components/page-header';
import { cn } from '@/lib/utils';
import { createGoal, createGoalFolder, goalFoldersQuery, goalsQuery, updateGoal } from '../api';
import { canWriteGoal, groupGoals } from '../goal-model';
import { useGoalActions } from '../hooks/use-goal-actions';
import { GoalCard } from './goal-card';
import { GoalDialog } from './goal-dialog';

function FolderDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState('');

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);

        if (next) {
          setName('');
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova pasta de metas</DialogTitle>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(submit) => {
            submit.preventDefault();

            if (name.trim() === '') {
              return;
            }

            onCreate(name.trim());
            onOpenChange(false);
          }}
        >
          <div>
            <Label htmlFor="goal-folder-name">Nome</Label>
            <Input
              id="goal-folder-name"
              autoFocus
              value={name}
              placeholder="Metas 2026"
              onChange={(change) => {
                setName(change.target.value);
              }}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onOpenChange(false);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="outline" disabled={name.trim() === ''}>
              Criar pasta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Metas do workspace em pastas, com o progresso de cada uma e os alvos. */
export function GoalsPage({ wsId }: { wsId: string }) {
  const client = useQueryClient();
  const session = useSession();
  const [mine, setMine] = useState(false);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [goalOpen, setGoalOpen] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const folders = useQuery(goalFoldersQuery(wsId));
  const goals = useQuery(
    goalsQuery(wsId, { ...(folderId ? { folderId } : {}), ...(mine ? { mine: true } : {}) }),
  );
  const members = useQuery(membersQuery(wsId));
  const actions = useGoalActions(wsId);

  const newFolder = useMutation({
    mutationFn: (name: string) => createGoalFolder(wsId, { name }),
    onSuccess: async (folder: GoalFolder) => {
      await client.invalidateQueries({ queryKey: ['workspaces', wsId, 'goal-folders'] });
      toast.success(`Pasta ${folder.name} criada.`);
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });

  const newGoal = useMutation({
    mutationFn: (body: CreateGoalInput) => createGoal(wsId, body),
    onSuccess: () => {
      actions.refresh();
      toast.success('Meta criada.');
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });

  const editGoal = useMutation({
    mutationFn: ({ goalId, body }: { goalId: string; body: UpdateGoalInput }) =>
      updateGoal(wsId, goalId, body),
    onSuccess: () => {
      actions.refresh();
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });

  const groups = groupGoals(goals.data ?? [], folders.data ?? []);
  const visible = folderId ? groups.filter((group) => group.folder?.id === folderId) : groups;

  return (
    <div className="flex min-w-0 flex-col gap-4 pb-10">
      <PageHeader
        wsId={wsId}
        title="Metas"
        description="O progresso de cada meta é a média dos alvos. Alvo de tarefas anda sozinho quando a tarefa é concluída."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFolderOpen(true);
              }}
            >
              Nova pasta
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setGoalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nova meta
            </Button>
          </div>
        }
      />

      <div className="flex min-w-0 flex-col gap-4 px-4 md:px-6">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div role="group" aria-label="Pastas de metas" className="flex min-w-0 flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={folderId === null}
              onClick={() => {
                setFolderId(null);
              }}
              className={cn(
                'min-h-11 rounded-full border px-3 text-[13px] md:min-h-9',
                folderId === null
                  ? 'border-scene-line bg-accent/[0.16] font-semibold text-ink'
                  : 'border-line text-body hover:bg-surface-2 hover:text-ink',
              )}
            >
              Todas
            </button>
            {(folders.data ?? []).map((folder) => (
              <button
                key={folder.id}
                type="button"
                aria-pressed={folderId === folder.id}
                onClick={() => {
                  setFolderId(folder.id);
                }}
                className={cn(
                  'min-h-11 rounded-full border px-3 text-[13px] md:min-h-9',
                  folderId === folder.id
                    ? 'border-scene-line bg-accent/[0.16] font-semibold text-ink'
                    : 'border-line text-body hover:bg-surface-2 hover:text-ink',
                )}
              >
                {folder.name}
              </button>
            ))}
          </div>

          <button
            type="button"
            aria-pressed={mine}
            onClick={() => {
              setMine((current) => !current);
            }}
            className={cn(
              'ml-auto min-h-11 rounded-full border px-3 text-[13px] md:min-h-9',
              mine
                ? 'border-scene-line bg-accent/[0.16] font-semibold text-ink'
                : 'border-line text-body hover:bg-surface-2 hover:text-ink',
            )}
          >
            Minhas metas
          </button>
        </div>

        {goals.isPending ? (
          <Skeleton className="h-40 w-full rounded-2xl" />
        ) : (goals.data ?? []).length === 0 ? (
          <EmptyState
            title="Nenhuma meta por aqui"
            description="Crie a primeira meta e some alvos de número, moeda, sim/não ou tarefas."
            icon={<Target className="h-6 w-6" aria-hidden="true" />}
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setGoalOpen(true);
                }}
              >
                Nova meta
              </Button>
            }
          />
        ) : (
          <div className="flex min-w-0 max-w-[1040px] flex-col gap-6">
            {visible.map((group) => (
              <section
                key={group.folder?.id ?? 'sem-pasta'}
                className="flex min-w-0 flex-col gap-3"
                aria-label={group.folder?.name ?? 'Sem pasta'}
              >
                <h2 className="text-[15px] font-semibold text-ink">
                  {group.folder?.name ?? 'Sem pasta'}
                </h2>

                {group.goals.length === 0 ? (
                  <p className="text-[13px] text-muted">Nenhuma meta nesta pasta.</p>
                ) : (
                  group.goals.map((view) => (
                    <GoalCard
                      key={view.goal.id}
                      wsId={wsId}
                      view={view}
                      members={members.data ?? []}
                      canWrite={session ? canWriteGoal(view.goal, session.id) : false}
                      onValue={(target, current) => {
                        void actions.setTargetValue(view.goal.id, target, current);
                      }}
                    />
                  ))
                )}
              </section>
            ))}
          </div>
        )}
      </div>

      <GoalDialog
        wsId={wsId}
        open={goalOpen}
        onOpenChange={setGoalOpen}
        folders={folders.data ?? []}
        view={null}
        {...(folderId ? { folderId } : {})}
        onCreate={(body) => {
          newGoal.mutate(body);
        }}
        onUpdate={(goalId, body) => {
          editGoal.mutate({ goalId, body });
        }}
      />

      <FolderDialog
        open={folderOpen}
        onOpenChange={setFolderOpen}
        onCreate={(name) => {
          newFolder.mutate(name);
        }}
      />
    </div>
  );
}
