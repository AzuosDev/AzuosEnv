import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Play, Plus, Square, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { WorkspaceMemberItem } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { formatDateField, fromDayTime, toDayTime } from '../task-fields';
import { createTimeEntry, deleteTimeEntry, timeEntriesQuery } from '../time-api';
import { useTick, useTimer } from '../hooks/use-timer';
import { elapsedSeconds, formatMinutes, formatStopwatch, parseDuration } from '../time-fields';

export interface TimeSectionProps {
  wsId: string;
  taskId: string;
  trackedMinutes: number;
  members: WorkspaceMemberItem[];
  currentUserId: string | null;
  onChanged: () => void;
}

/**
 * Tempo da tarefa: cronômetro (que também aparece na topbar), total rastreado
 * e lançamento manual. A API só aceita um cronômetro por pessoa.
 */
export function TimeSection({
  wsId,
  taskId,
  trackedMinutes,
  members,
  currentUserId,
  onChanged,
}: TimeSectionProps) {
  const queryClient = useQueryClient();
  const entries = useQuery(timeEntriesQuery(wsId, taskId));
  const { running, start, stop, pending } = useTimer(wsId);
  const runningHere = running?.taskId === taskId ? running : null;
  const now = useTick(Boolean(runningHere));
  const dayId = useId();
  const durationId = useId();
  const noteId = useId();
  const [day, setDay] = useState(() => toDayTime(new Date().toISOString()).day);
  const [duration, setDuration] = useState('');
  const [note, setNote] = useState('');

  const onError = (error: unknown): void => {
    toast.error(errorMessage(error));
  };

  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.timeEntries(wsId, taskId) });
    onChanged();
  };

  const create = useMutation({
    mutationFn: ({ start: startAt, durationMinutes }: { start: string; durationMinutes: number }) =>
      createTimeEntry(wsId, {
        taskId,
        start: startAt,
        durationMinutes,
        ...(note.trim() === '' ? {} : { note: note.trim() }),
      }),
    onSuccess: () => {
      setDuration('');
      setNote('');
      refresh();
      toast.success('Tempo lançado.');
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (entryId: string) => deleteTimeEntry(wsId, entryId),
    onSuccess: refresh,
    onError,
  });

  const list = entries.data ?? [];
  const minutes = parseDuration(duration);
  const canCreate = day !== '' && minutes !== null && minutes > 0 && !create.isPending;

  return (
    <section aria-labelledby="task-time-heading" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="task-time-heading" className="text-[12.5px] font-semibold text-muted">
          Tempo
        </h2>
        <span className="text-[12px] text-muted">{formatMinutes(trackedMinutes)} rastreados</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {runningHere ? (
          <>
            <span
              role="timer"
              aria-label={`Cronômetro desta tarefa: ${formatStopwatch(elapsedSeconds(runningHere.start, now))}`}
              className="font-mono text-[14px] font-semibold tabular-nums text-accent"
            >
              {formatStopwatch(elapsedSeconds(runningHere.start, now))}
            </span>
            <Button variant="ghost" size="sm" disabled={pending} onClick={stop}>
              <Square className="h-3.5 w-3.5" aria-hidden="true" />
              Parar
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => {
              start(taskId);
            }}
          >
            <Play className="h-3.5 w-3.5" aria-hidden="true" />
            Iniciar cronômetro
          </Button>
        )}
      </div>

      <form
        className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3"
        onSubmit={(event) => {
          event.preventDefault();

          const iso = fromDayTime(day);

          if (iso && minutes !== null && minutes > 0) {
            create.mutate({ start: iso, durationMinutes: minutes });
          }
        }}
      >
        <p className="text-[12.5px] font-semibold text-body">Lançamento manual</p>

        <div className="flex flex-wrap gap-2">
          <label
            htmlFor={dayId}
            className="flex min-w-0 flex-1 flex-col gap-1 text-[12px] text-muted"
          >
            Dia
            <input
              id={dayId}
              type="date"
              value={day}
              onChange={(event) => {
                setDay(event.target.value);
              }}
              className="h-10 rounded-xl border border-line bg-surface px-3 text-[13px] text-ink outline-none focus-visible:border-accent"
            />
          </label>

          <label
            htmlFor={durationId}
            className="flex min-w-0 flex-1 flex-col gap-1 text-[12px] text-muted"
          >
            Duração
            <Input
              id={durationId}
              value={duration}
              placeholder="1h30"
              className="h-10"
              onChange={(event) => {
                setDuration(event.target.value);
              }}
            />
          </label>
        </div>

        <label htmlFor={noteId} className="flex flex-col gap-1 text-[12px] text-muted">
          Nota
          <Input
            id={noteId}
            value={note}
            placeholder="O que foi feito (opcional)"
            className="h-10"
            onChange={(event) => {
              setNote(event.target.value);
            }}
          />
        </label>

        <Button type="submit" size="sm" disabled={!canCreate} className="self-start">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Lançar tempo
        </Button>
      </form>

      <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-surface">
        {list.length === 0 ? (
          <li className="px-3 py-2.5 text-[12.5px] text-muted">Nenhum lançamento ainda.</li>
        ) : null}

        {list.map((entry) => {
          const person = members.find((member) => member.userId.id === entry.userId)?.userId;

          return (
            <li key={entry.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <span className="shrink-0 text-[13px] font-semibold text-ink">
                {entry.end ? formatMinutes(entry.durationMinutes) : 'Em andamento'}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-muted">
                {formatDateField(entry.start, true)}
                {person ? ` · ${person.name}` : ''}
                {entry.note ? ` · ${entry.note}` : ''}
              </span>
              {entry.userId === currentUserId ? (
                <Button
                  variant="nav"
                  size="icon"
                  aria-label="Excluir lançamento"
                  className="h-8 w-8"
                  disabled={remove.isPending}
                  onClick={() => {
                    remove.mutate(entry.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
