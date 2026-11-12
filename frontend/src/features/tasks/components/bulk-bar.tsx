import { CalendarDays, Flag, MoveRight, Trash2, UserPlus, X } from 'lucide-react';
import { useState } from 'react';
import type { Task } from '@/api/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { StatusPill } from '@/components/ui/status-pill';
import { ConfirmDialog } from '@/features/settings/components/confirm-dialog';
import { ListPicker } from './list-picker';
import { AssigneesPicker, DuePicker, PriorityPicker, StatusPicker } from './task-pickers';
import type { ViewSurfaceProps } from './view-surface';

export interface BulkBarProps {
  surface: ViewSurfaceProps;
  onClear: () => void;
}

/** Barra de ações em massa; aparece quando há tarefa selecionada. */
export function BulkBar({ surface, onClear }: BulkBarProps) {
  const [moving, setMoving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [targetList, setTargetList] = useState('');
  const ids = [...surface.selected];
  const count = ids.length;

  if (count === 0) {
    return null;
  }

  const apply = (
    changes: Parameters<typeof surface.actions.bulk.mutate>[0]['changes'],
    optimistic?: (task: Task) => Partial<Task>,
  ): void => {
    surface.actions.bulk.mutate({ ids, changes, ...(optimistic ? { optimistic } : {}) });
    onClear();
  };

  return (
    <div className="sticky bottom-0 z-20 flex flex-wrap items-center gap-2 border-t border-line bg-paper-2 px-3 py-2 md:px-6">
      <p className="text-[13px] font-semibold text-ink" role="status">
        {count === 1 ? '1 tarefa selecionada' : `${String(count)} tarefas selecionadas`}
      </p>

      <StatusPicker
        statuses={surface.statuses}
        value={undefined}
        align="center"
        onSelect={(statusId) => {
          const picked = surface.statuses.find((item) => item.id === statusId);

          apply({ statusId }, () => ({
            statusId,
            ...(picked ? { statusGroup: picked.group } : {}),
          }));
        }}
      >
        <Button variant="ghost" size="sm">
          <StatusPill className="px-1.5 py-0">Status</StatusPill>
        </Button>
      </StatusPicker>

      <AssigneesPicker
        members={surface.members}
        value={[]}
        align="center"
        onChange={(assigneeIds) => {
          if (assigneeIds.length > 0) {
            apply({ addAssigneeIds: assigneeIds }, (task) => ({
              assigneeIds: [...new Set([...task.assigneeIds, ...assigneeIds])],
            }));
          }
        }}
      >
        <Button variant="ghost" size="sm">
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Responsável
        </Button>
      </AssigneesPicker>

      <PriorityPicker
        value={null}
        align="center"
        onSelect={(priority) => {
          apply({ priority }, () => ({ priority }));
        }}
      >
        <Button variant="ghost" size="sm">
          <Flag className="h-4 w-4" aria-hidden="true" />
          Prioridade
        </Button>
      </PriorityPicker>

      <DuePicker
        value={null}
        align="center"
        onChange={(dueAt) => {
          apply({ dueAt }, () => ({ dueAt }));
        }}
      >
        <Button variant="ghost" size="sm">
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
          Prazo
        </Button>
      </DuePicker>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setMoving(true);
        }}
      >
        <MoveRight className="h-4 w-4" aria-hidden="true" />
        Mover
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="text-danger"
        onClick={() => {
          setRemoving(true);
        }}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        Excluir
      </Button>

      <span className="flex-1" />

      <Button variant="nav" size="sm" onClick={onClear}>
        <X className="h-4 w-4" aria-hidden="true" />
        Limpar seleção
      </Button>

      <Dialog open={moving} onOpenChange={setMoving}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mover tarefas</DialogTitle>
            <DialogDescription>
              As {count} tarefas selecionadas vão para a List escolhida.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bulk-move-list">List de destino</Label>
            <ListPicker
              id="bulk-move-list"
              wsId={surface.wsId}
              value={targetList}
              onChange={setTargetList}
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setMoving(false);
              }}
            >
              Cancelar
            </Button>
            <Button
              disabled={targetList === ''}
              onClick={() => {
                apply({ listId: targetList });
                setMoving(false);
                setTargetList('');
              }}
            >
              Mover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        title="Excluir tarefas"
        description={`As ${String(count)} tarefas vão para a lixeira e ficam 30 dias lá.`}
        confirmLabel="Excluir"
        danger
        onConfirm={() => {
          apply({ deleted: true });
          setRemoving(false);
        }}
      />
    </div>
  );
}
