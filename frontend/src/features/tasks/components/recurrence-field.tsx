import { Repeat } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import type { TaskRecurrence, TaskRecurrenceInput } from '@/api/types';
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
import { SelectNative } from '@/components/ui/select-native';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  MAX_INTERVAL,
  RECURRENCE_FREQ_LABEL,
  RECURRENCE_FREQ_ORDER,
  RECURRENCE_MODE_HINT,
  RECURRENCE_MODE_LABEL,
  WEEKDAY_CODES,
  WEEKDAY_LABEL,
  describeRecurrence,
  toDraft,
  toRecurrenceInput,
  type RecurrenceDraft,
  type RecurrenceFreq,
  type WeekdayCode,
} from '../recurrence';

export interface RecurrenceFieldProps {
  value: TaskRecurrence | null;
  disabled: boolean;
  onChange: (recurrence: TaskRecurrenceInput | null) => void;
}

const MODES = ['onComplete', 'onSchedule'] as const;

/**
 * Recorrência da tarefa: resumo em uma linha e um editor amigável que monta a
 * regra do iCalendar (diária, semanal com dias, mensal ou personalizada).
 */
export function RecurrenceField({ value, disabled, onChange }: RecurrenceFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<RecurrenceDraft>(() => toDraft(value));
  const freqId = useId();
  const intervalId = useId();
  const monthDayId = useId();
  const customId = useId();
  const createNewId = useId();

  // Reabrir o editor recomeça do que está gravado na tarefa.
  useEffect(() => {
    if (open) {
      setDraft(toDraft(value));
    }
  }, [open, value]);

  const input = toRecurrenceInput(draft);
  const everyLabel: Record<RecurrenceFreq, string> = {
    daily: 'dias',
    weekly: 'semanas',
    monthly: 'meses',
    custom: 'vezes',
  };

  return (
    <div className="flex min-w-0 items-center gap-1">
      <Button
        variant="nav"
        size="sm"
        disabled={disabled}
        className="min-w-0 justify-start px-1.5 font-normal"
        onClick={() => {
          setOpen(true);
        }}
      >
        <Repeat
          className={cn('h-3.5 w-3.5 shrink-0', value ? 'text-accent' : 'text-muted')}
          aria-hidden="true"
        />
        <span className={cn('min-w-0 truncate text-[13px]', value ? 'text-body' : 'text-muted')}>
          {describeRecurrence(value)}
          {value ? ` · ${RECURRENCE_MODE_LABEL[value.mode]}` : ''}
        </span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recorrência</DialogTitle>
            <DialogDescription>
              A tarefa se repete conforme a regra; o prazo atual é a âncora.
            </DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[60dvh] flex-col gap-3 overflow-y-auto">
            <label htmlFor={freqId} className="flex flex-col gap-1.5 text-[13px] text-body">
              Frequência
              <SelectNative
                id={freqId}
                value={draft.freq}
                onChange={(event) => {
                  setDraft((current) => ({
                    ...current,
                    freq: event.target.value as RecurrenceFreq,
                  }));
                }}
              >
                {RECURRENCE_FREQ_ORDER.map((freq) => (
                  <option key={freq} value={freq}>
                    {RECURRENCE_FREQ_LABEL[freq]}
                  </option>
                ))}
              </SelectNative>
            </label>

            {draft.freq === 'custom' ? (
              <label htmlFor={customId} className="flex flex-col gap-1.5 text-[13px] text-body">
                Regra (RRULE)
                <Input
                  id={customId}
                  value={draft.custom}
                  placeholder="FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE"
                  onChange={(event) => {
                    setDraft((current) => ({ ...current, custom: event.target.value }));
                  }}
                />
                <span className="text-[12px] text-muted">
                  Padrão iCalendar; a API recusa uma regra inválida.
                </span>
              </label>
            ) : (
              <label htmlFor={intervalId} className="flex flex-col gap-1.5 text-[13px] text-body">
                A cada
                <span className="flex items-center gap-2">
                  <Input
                    id={intervalId}
                    type="number"
                    min={1}
                    max={MAX_INTERVAL}
                    value={String(draft.interval)}
                    className="w-24"
                    onChange={(event) => {
                      setDraft((current) => ({
                        ...current,
                        interval: Number(event.target.value),
                      }));
                    }}
                  />
                  <span className="text-[13px] text-muted">{everyLabel[draft.freq]}</span>
                </span>
              </label>
            )}

            {draft.freq === 'weekly' ? (
              <fieldset className="flex flex-col gap-2">
                <legend className="pb-1 text-[13px] text-body">Dias da semana</legend>
                <div className="flex flex-wrap gap-1">
                  {WEEKDAY_CODES.map((code) => {
                    const picked = draft.weekdays.includes(code);

                    return (
                      <button
                        key={code}
                        type="button"
                        aria-pressed={picked}
                        className={cn(
                          'h-11 min-w-11 rounded-xl border px-2 text-[13px] md:h-10',
                          picked
                            ? 'border-scene-line bg-scene text-ink'
                            : 'border-line text-body hover:bg-surface-2',
                        )}
                        onClick={() => {
                          setDraft((current) => ({
                            ...current,
                            weekdays: picked
                              ? current.weekdays.filter((item) => item !== code)
                              : [...current.weekdays, code as WeekdayCode],
                          }));
                        }}
                      >
                        {WEEKDAY_LABEL[code]}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ) : null}

            {draft.freq === 'monthly' ? (
              <label htmlFor={monthDayId} className="flex flex-col gap-1.5 text-[13px] text-body">
                Dia do mês
                <Input
                  id={monthDayId}
                  type="number"
                  min={1}
                  max={31}
                  value={String(draft.monthDay)}
                  className="w-24"
                  onChange={(event) => {
                    setDraft((current) => ({ ...current, monthDay: Number(event.target.value) }));
                  }}
                />
              </label>
            ) : null}

            <fieldset className="flex flex-col gap-2">
              <legend className="pb-1 text-[13px] text-body">Quando a próxima nasce</legend>
              <div
                role="radiogroup"
                aria-label="Modo da recorrência"
                className="flex flex-col gap-1"
              >
                {MODES.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={draft.mode === mode}
                    className={cn(
                      'flex min-h-11 flex-col justify-center rounded-xl border px-3 py-1.5 text-left',
                      draft.mode === mode
                        ? 'border-scene-line bg-scene'
                        : 'border-line hover:bg-surface-2',
                    )}
                    onClick={() => {
                      setDraft((current) => ({ ...current, mode }));
                    }}
                  >
                    <span className="text-[13px] text-ink">{RECURRENCE_MODE_LABEL[mode]}</span>
                    <span className="text-[12px] text-muted">{RECURRENCE_MODE_HINT[mode]}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <label
              htmlFor={createNewId}
              className="flex items-center justify-between gap-2 text-[13px] text-body"
            >
              <span className="min-w-0">
                Criar uma tarefa nova
                <span className="block text-[12px] text-muted">
                  Desligado, a própria tarefa reabre com as novas datas.
                </span>
              </span>
              <Switch
                id={createNewId}
                checked={draft.createNew}
                onCheckedChange={(createNew) => {
                  setDraft((current) => ({ ...current, createNew }));
                }}
              />
            </label>
          </div>

          <DialogFooter>
            {value ? (
              <Button
                variant="ghost"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                Remover recorrência
              </Button>
            ) : null}
            <Button
              variant="outline"
              disabled={input === null}
              onClick={() => {
                if (input) {
                  onChange(input);
                  setOpen(false);
                }
              }}
            >
              Salvar recorrência
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
