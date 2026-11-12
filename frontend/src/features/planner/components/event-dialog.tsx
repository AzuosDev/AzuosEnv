import { useEffect, useState } from 'react';
import type { CalendarEvent, CreateEventInput, UpdateEventInput } from '@/api/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toDayKey } from '@/features/views/calendar-model';
import { minutesLabel, minutesOfDay } from '../planner-model';

export interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Dia sugerido quando o evento é novo. */
  day: string;
  event: CalendarEvent | null;
  onCreate: (body: CreateEventInput) => void;
  onUpdate: (eventId: string, body: UpdateEventInput) => void;
}

interface Draft {
  title: string;
  day: string;
  start: string;
  end: string;
  meetUrl: string;
}

function draftOf(event: CalendarEvent | null, day: string): Draft {
  if (!event) {
    return { title: '', day, start: '09:00', end: '10:00', meetUrl: '' };
  }

  const eventDay = toDayKey(new Date(event.start));

  return {
    title: event.title,
    day: eventDay,
    start: minutesLabel(minutesOfDay(event.start, eventDay)),
    end: minutesLabel(minutesOfDay(event.end, eventDay)),
    meetUrl: event.meetUrl ?? '',
  };
}

/** "2026-10-28" + "09:30" no fuso de quem usa. */
function isoOf(day: string, time: string): string {
  return new Date(`${day}T${time}:00`).toISOString();
}

/** Evento da agenda: título, dia, horário e link da reunião. */
export function EventDialog({
  open,
  onOpenChange,
  day,
  event,
  onCreate,
  onUpdate,
}: EventDialogProps) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(event, day));

  useEffect(() => {
    if (open) {
      setDraft(draftOf(event, day));
    }
  }, [day, event, open]);

  const invalid = draft.title.trim() === '' || draft.end <= draft.start;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{event ? 'Editar evento' : 'Novo evento'}</DialogTitle>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(submit) => {
            submit.preventDefault();

            if (invalid) {
              return;
            }

            const body = {
              title: draft.title.trim(),
              start: isoOf(draft.day, draft.start),
              end: isoOf(draft.day, draft.end),
              ...(draft.meetUrl.trim() === '' ? {} : { meetUrl: draft.meetUrl.trim() }),
            };

            if (event) {
              onUpdate(event.id, body);
            } else {
              onCreate(body);
            }

            onOpenChange(false);
          }}
        >
          <div>
            <Label htmlFor="event-title">Título</Label>
            <Input
              id="event-title"
              autoFocus
              value={draft.title}
              placeholder="Reunião com a Cênio Construções"
              onChange={(change) => {
                setDraft((current) => ({ ...current, title: change.target.value }));
              }}
            />
          </div>

          <div>
            <Label htmlFor="event-day">Dia</Label>
            <Input
              id="event-day"
              type="date"
              value={draft.day}
              onChange={(change) => {
                setDraft((current) => ({ ...current, day: change.target.value }));
              }}
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="event-start">Início</Label>
              <Input
                id="event-start"
                type="time"
                step={900}
                value={draft.start}
                onChange={(change) => {
                  setDraft((current) => ({ ...current, start: change.target.value }));
                }}
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="event-end">Fim</Label>
              <Input
                id="event-end"
                type="time"
                step={900}
                value={draft.end}
                onChange={(change) => {
                  setDraft((current) => ({ ...current, end: change.target.value }));
                }}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="event-meet">Link da reunião</Label>
            <Input
              id="event-meet"
              type="url"
              value={draft.meetUrl}
              placeholder="https://meet.google.com/abc-defg-hij"
              onChange={(change) => {
                setDraft((current) => ({ ...current, meetUrl: change.target.value }));
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
            <Button type="submit" disabled={invalid}>
              {event ? 'Salvar' : 'Criar evento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
