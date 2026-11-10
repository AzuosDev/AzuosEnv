import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Bell, Check, Repeat, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { Reminder } from '@/api/types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { toast } from '@/components/ui/toast';
import { FormAlert } from '@/features/auth/components/field';
import { formatDateField } from '@/features/tasks/task-fields';
import { deleteReminder, remindersQuery, updateReminder } from '../api';
import { RECURRENCE_LABEL } from '../reminder-fields';
import { ReminderDialog } from './reminder-dialog';

/** Lembretes do usuário: pendentes em cima, concluídos abaixo. */
export function RemindersPanel({ wsId }: { wsId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const pending = useQuery(remindersQuery(wsId, 'pending'));
  const done = useQuery(remindersQuery(wsId, 'done'));

  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.reminders(wsId, 'pending') });
    void queryClient.invalidateQueries({ queryKey: queryKeys.reminders(wsId, 'done') });
  };

  const fail = (error: unknown): void => {
    toast.error(errorMessage(error));
  };

  const finish = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) =>
      updateReminder(wsId, id, { done: value }),
    onSuccess: (_data, { value }) => {
      refresh();
      toast.success(value ? 'Lembrete concluído.' : 'Lembrete reaberto.');
    },
    onError: fail,
  });

  const remove = useMutation({
    mutationFn: ({ id }: { id: string }) => deleteReminder(wsId, id),
    onSuccess: () => {
      refresh();
      toast.success('Lembrete excluído.');
    },
    onError: fail,
  });

  const pendingItems = pending.data ?? [];
  const doneItems = done.data ?? [];

  const row = (reminder: Reminder, concluded: boolean) => (
    <li
      key={reminder.id}
      className="flex flex-col gap-2 border-b border-line px-3 py-3 last:border-b-0 md:flex-row md:items-center md:justify-between"
    >
      <div className="flex min-w-0 items-start gap-3">
        <Bell className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium text-ink">{reminder.text}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
            <span>{formatDateField(reminder.remindAt, true)}</span>
            {reminder.recurrence === 'none' ? null : (
              <span className="flex items-center gap-1">
                <Repeat className="h-3.5 w-3.5" aria-hidden="true" />
                {RECURRENCE_LABEL[reminder.recurrence]}
              </span>
            )}
            {reminder.taskId ? (
              <Link
                to="/w/$wsId/t/$customId"
                params={{ wsId, customId: reminder.taskId }}
                className="text-accent"
              >
                Abrir a tarefa
              </Link>
            ) : null}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {concluded ? <StatusPill tone="success">Concluído</StatusPill> : null}
        <Button
          variant="ghost"
          size="sm"
          disabled={finish.isPending}
          onClick={() => {
            finish.mutate({ id: reminder.id, value: !concluded });
          }}
        >
          <Check className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {concluded ? 'Reabrir' : 'Concluir'}
        </Button>
        <Button
          variant="nav"
          size="icon"
          aria-label={`Excluir o lembrete “${reminder.text}”`}
          className="h-11 w-11 md:h-9 md:w-9"
          onClick={() => {
            remove.mutate({ id: reminder.id });
          }}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </li>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-ink">Lembretes</h2>
        {/* O estado vazio já carrega a ação; dois botões iguais seriam ruído. */}
        {pendingItems.length > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setOpen(true);
            }}
          >
            Novo lembrete
          </Button>
        ) : null}
      </div>

      {pending.isPending ? <Skeleton className="h-24" /> : null}
      {pending.isError ? <FormAlert>{errorMessage(pending.error)}</FormAlert> : null}

      {pending.data && pendingItems.length === 0 ? (
        <EmptyState
          title="Nenhum lembrete pendente"
          description="Crie um lembrete para o que precisa voltar à sua caixa de entrada."
          action={
            <Button
              variant="ghost"
              onClick={() => {
                setOpen(true);
              }}
            >
              Novo lembrete
            </Button>
          }
        />
      ) : null}

      {pendingItems.length > 0 ? (
        <ul className="flex flex-col rounded-2xl border border-line bg-surface">
          {pendingItems.map((reminder) => row(reminder, false))}
        </ul>
      ) : null}

      {doneItems.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h3 className="px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            Concluídos
          </h3>
          <ul className="flex flex-col rounded-2xl border border-line bg-surface">
            {doneItems.map((reminder) => row(reminder, true))}
          </ul>
        </section>
      ) : null}

      <ReminderDialog wsId={wsId} open={open} onOpenChange={setOpen} />
    </div>
  );
}
