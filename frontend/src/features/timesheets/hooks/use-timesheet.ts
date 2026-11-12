import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/toast';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import { createTimeEntry, deleteTimeEntry, updateTimeEntry } from '@/features/tasks/time-api';
import { reviewTimesheet, submitTimesheet } from '../api';
import { CELL_TIME, type CellEntry, type CellOp, planBillable, planCell } from '../timesheet-model';

export interface SetCellInput {
  taskId: string;
  day: string;
  entries: CellEntry[];
  minutes: number;
  billable: boolean;
}

export interface SetRowBillableInput {
  entries: CellEntry[];
  billable: boolean;
}

/** Escritas da grade da semana, sempre na ordem do plano. */
async function runOps(wsId: string, ops: CellOp[]): Promise<void> {
  for (const op of ops) {
    if (op.kind === 'create') {
      await createTimeEntry(wsId, {
        taskId: op.taskId,
        start: new Date(`${op.day}T${CELL_TIME}:00`).toISOString(),
        durationMinutes: op.minutes,
        billable: op.billable,
      });
      continue;
    }

    if (op.kind === 'update') {
      await updateTimeEntry(wsId, op.entryId, { durationMinutes: op.minutes });
      continue;
    }

    await deleteTimeEntry(wsId, op.entryId);
  }
}

/**
 * Ações da semana: lançar horas numa célula, trocar o faturável da linha,
 * enviar para aprovação e decidir como admin. Toda escrita recarrega a grade e
 * os lançamentos, que são a fonte dos minutos e dos ids.
 */
export function useTimesheetActions(wsId: string, userId?: string) {
  const queryClient = useQueryClient();
  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['workspaces', wsId, 'timesheets'] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.timer(wsId) });
  };
  const onError = (error: unknown): void => {
    toast.error(errorMessage(error));
  };

  const setCell = useMutation({
    mutationFn: async (input: SetCellInput) =>
      runOps(wsId, planCell(input.taskId, input.day, input.entries, input.minutes, input.billable)),
    onSuccess: refresh,
    onError,
  });

  const setRowBillable = useMutation({
    mutationFn: async (input: SetRowBillableInput) => {
      for (const entryId of planBillable(input.entries, input.billable)) {
        await updateTimeEntry(wsId, entryId, { billable: input.billable });
      }
    },
    onSuccess: refresh,
    onError,
  });

  const submit = useMutation({
    mutationFn: (weekStart: string) => submitTimesheet(wsId, weekStart),
    onSuccess: () => {
      toast.success('Semana enviada para aprovação.');
      refresh();
    },
    onError,
  });

  const review = useMutation({
    mutationFn: (input: { decision: 'approve' | 'reject'; userId: string; weekStart: string }) =>
      reviewTimesheet(wsId, input.decision, {
        userId: input.userId,
        weekStart: input.weekStart,
      }),
    onSuccess: (_result, input) => {
      toast.success(input.decision === 'approve' ? 'Semana aprovada.' : 'Semana recusada.');
      refresh();
    },
    onError,
  });

  return { setCell, setRowBillable, submit, review, userId };
}
