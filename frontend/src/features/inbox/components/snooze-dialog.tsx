import { useState } from 'react';
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
import { fromDayTime, toDayTime } from '@/features/tasks/task-fields';

export interface SnoozeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (until: string) => void;
}

/** Adiar para uma data escolhida à mão; dia e hora separados, como no painel. */
export function SnoozeDialog({ open, onOpenChange, onConfirm }: SnoozeDialogProps) {
  const start = toDayTime(new Date().toISOString());
  const [day, setDay] = useState(start.day);
  const [time, setTime] = useState('09:00');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adiar notificação</DialogTitle>
          <DialogDescription>
            Ela sai da caixa e volta na data escolhida, no seu fuso.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 md:flex-row">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Label htmlFor="snooze-day">Dia</Label>
            <Input
              id="snooze-day"
              type="date"
              value={day}
              onChange={(event) => {
                setDay(event.target.value);
              }}
            />
          </div>
          <div className="flex w-full flex-col gap-1.5 md:w-32">
            <Label htmlFor="snooze-time">Hora</Label>
            <Input
              id="snooze-time"
              type="time"
              value={time}
              onChange={(event) => {
                setTime(event.target.value);
              }}
            />
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
            disabled={day === ''}
            onClick={() => {
              const until = fromDayTime(day, time);

              if (until) {
                onConfirm(until);
              }
            }}
          >
            Adiar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
