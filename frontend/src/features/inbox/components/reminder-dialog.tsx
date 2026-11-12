import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { ReminderRecurrence } from '@/api/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectNative } from '@/components/ui/select-native';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { FormAlert } from '@/features/auth/components/field';
import { TaskSearchPicker } from '@/features/tasks/components/task-search-picker';
import { fromDayTime, toDayTime } from '@/features/tasks/task-fields';
import { createReminder } from '../api';
import { RECURRENCE_OPTIONS } from '../reminder-fields';

export interface ReminderDialogProps {
  wsId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Novo lembrete: texto, quando, se repete e a tarefa opcional. */
export function ReminderDialog({ wsId, open, onOpenChange }: ReminderDialogProps) {
  const queryClient = useQueryClient();
  const today = toDayTime(new Date().toISOString());
  const [text, setText] = useState('');
  const [day, setDay] = useState(today.day);
  const [time, setTime] = useState('09:00');
  const [recurrence, setRecurrence] = useState<ReminderRecurrence>('none');
  const [task, setTask] = useState<{ id: string; label: string } | null>(null);

  const create = useMutation({
    mutationFn: () =>
      createReminder(wsId, {
        text: text.trim(),
        remindAt: fromDayTime(day, time) ?? new Date().toISOString(),
        recurrence,
        ...(task ? { taskId: task.id } : {}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.reminders(wsId, 'pending') });
      toast.success('Lembrete criado.');
      setText('');
      setTask(null);
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo lembrete</DialogTitle>
          <DialogDescription>Ele chega na sua caixa de entrada na data marcada.</DialogDescription>
        </DialogHeader>

        {create.isError ? <FormAlert>{errorMessage(create.error)}</FormAlert> : null}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reminder-text">O que lembrar</Label>
          <Input
            id="reminder-text"
            autoFocus
            maxLength={500}
            placeholder="Revisar o orçamento do PDV"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
            }}
          />
        </div>

        <div className="flex flex-col gap-3 md:flex-row">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Label htmlFor="reminder-day">Dia</Label>
            <Input
              id="reminder-day"
              type="date"
              value={day}
              onChange={(event) => {
                setDay(event.target.value);
              }}
            />
          </div>
          <div className="flex w-full flex-col gap-1.5 md:w-32">
            <Label htmlFor="reminder-time">Hora</Label>
            <Input
              id="reminder-time"
              type="time"
              value={time}
              onChange={(event) => {
                setTime(event.target.value);
              }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reminder-recurrence">Repetir</Label>
          <SelectNative
            id="reminder-recurrence"
            value={recurrence}
            onChange={(event) => {
              setRecurrence(event.target.value as ReminderRecurrence);
            }}
          >
            {RECURRENCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectNative>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-body">Tarefa (opcional)</span>
          <div className="flex flex-wrap items-center gap-2">
            <TaskSearchPicker
              wsId={wsId}
              onPick={(picked) => {
                setTask({ id: picked.id, label: `${picked.customId} ${picked.name}` });
              }}
            >
              <Button variant="ghost" size="sm" type="button">
                {task ? 'Trocar tarefa' : 'Vincular tarefa'}
              </Button>
            </TaskSearchPicker>
            {task ? (
              <>
                <span className="min-w-0 truncate text-[12.5px] text-body">{task.label}</span>
                <Button
                  variant="nav"
                  size="sm"
                  type="button"
                  onClick={() => {
                    setTask(null);
                  }}
                >
                  Tirar
                </Button>
              </>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancelar
          </Button>
          <Button
            disabled={text.trim() === '' || day === '' || create.isPending}
            onClick={() => {
              create.mutate();
            }}
          >
            {create.isPending ? <Spinner label="Criando" /> : 'Criar lembrete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
