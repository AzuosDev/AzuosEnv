import { CalendarClock, CalendarPlus, Hash, Timer } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import type {
  TaskDetail,
  TaskPriority,
  TaskRecurrenceInput,
  TaskType,
  WorkspaceMemberItem,
} from '@/api/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PriorityFlag } from '@/components/ui/priority-flag';
import { SelectNative } from '@/components/ui/select-native';
import { Switch } from '@/components/ui/switch';
import { TASK_TYPE_OPTIONS, formatDateField, fromDayTime, toDayTime } from '../task-fields';
import { durationInput, formatMinutes, parseDuration } from '../time-fields';
import { AssigneeStack } from './assignee-stack';
import { RecurrenceField } from './recurrence-field';
import { TagPicker } from './tag-picker';
import { AssigneesPicker, PriorityPicker } from './task-pickers';

export interface TaskPanelFieldsProps {
  wsId: string;
  spaceId: string;
  task: TaskDetail;
  members: WorkspaceMemberItem[];
  onPatch: (body: Partial<TaskDetail>) => void;
  /** A recorrência vai por caminho próprio: o corpo dela é o DTO da API. */
  onRecurrence: (recurrence: TaskRecurrenceInput | null) => void;
}

const triggerClass =
  'flex min-h-9 w-full items-center gap-1.5 rounded-lg px-1.5 py-1 text-left text-[13px] text-body hover:bg-surface-2 hover:text-ink';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[104px_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[120px_minmax(0,1fr)]">
      <dt className="text-[12.5px] text-muted">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

/** Data (e hora, quando a tarefa usa hora) num popover com os campos nativos. */
function DateField({
  label,
  value,
  withTime,
  onChange,
  icon,
}: {
  label: string;
  value: string | null;
  withTime: boolean;
  onChange: (iso: string | null) => void;
  icon: ReactNode;
}) {
  const dayId = useId();
  const timeId = useId();
  const parts = toDayTime(value);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label}: ${formatDateField(value, withTime)}`}
          className={triggerClass}
        >
          {icon}
          <span className={value ? 'text-body' : 'text-muted'}>
            {formatDateField(value, withTime)}
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-64">
        <div className="flex flex-col gap-3">
          <label
            htmlFor={dayId}
            className="flex flex-col gap-1.5 text-[12.5px] font-medium text-body"
          >
            {label}
            <input
              id={dayId}
              type="date"
              value={parts.day}
              onChange={(event) => {
                onChange(fromDayTime(event.target.value, withTime ? parts.time : ''));
              }}
              className="h-11 rounded-xl border border-line bg-surface px-3 text-ink outline-none focus-visible:border-accent md:h-10"
            />
          </label>

          {withTime ? (
            <label
              htmlFor={timeId}
              className="flex flex-col gap-1.5 text-[12.5px] font-medium text-body"
            >
              Hora
              <input
                id={timeId}
                type="time"
                value={parts.time}
                disabled={parts.day === ''}
                onChange={(event) => {
                  onChange(fromDayTime(parts.day, event.target.value));
                }}
                className="h-11 rounded-xl border border-line bg-surface px-3 text-ink outline-none focus-visible:border-accent md:h-10"
              />
            </label>
          ) : null}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange(null);
            }}
          >
            Limpar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Campo numérico que só grava quando sai do foco ou no Enter. */
function NumberField({
  label,
  value,
  format,
  parse,
  onCommit,
  icon,
  placeholder,
}: {
  label: string;
  value: string;
  format: string;
  parse: (text: string) => number | null;
  onCommit: (parsed: number) => void;
  icon: ReactNode;
  placeholder: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? value;

  const commit = (): void => {
    const parsed = parse(text);

    setDraft(null);

    if (parsed !== null) {
      onCommit(parsed);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className="shrink-0 text-muted">{icon}</span>
      <Input
        aria-label={label}
        value={text}
        placeholder={placeholder}
        title={format}
        className="h-9 border-transparent bg-transparent px-1.5 text-[13px] hover:bg-surface-2 focus-visible:border-accent focus-visible:bg-surface"
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          }

          if (event.key === 'Escape') {
            setDraft(null);
          }
        }}
      />
    </div>
  );
}

/**
 * Campos da tarefa: responsáveis, prioridade, datas, estimativa, pontos, tags
 * e tipo. Cada escolha grava na hora; não existe botão de salvar.
 */
export function TaskPanelFields({
  wsId,
  spaceId,
  task,
  members,
  onPatch,
  onRecurrence,
}: TaskPanelFieldsProps) {
  const typeId = useId();

  return (
    <dl className="flex flex-col gap-1.5">
      <Row label="Responsáveis">
        <AssigneesPicker
          members={members}
          value={task.assigneeIds}
          onChange={(assigneeIds) => {
            onPatch({ assigneeIds });
          }}
        >
          <button type="button" aria-label="Escolher responsáveis" className={triggerClass}>
            <AssigneeStack ids={task.assigneeIds} members={members} max={4} />
          </button>
        </AssigneesPicker>
      </Row>

      <Row label="Prioridade">
        <PriorityPicker
          value={task.priority}
          onSelect={(priority) => {
            onPatch({ priority: priority as TaskPriority | null });
          }}
        >
          <button type="button" aria-label="Escolher prioridade" className={triggerClass}>
            {task.priority ? (
              <PriorityFlag priority={task.priority} withLabel />
            ) : (
              <span className="text-muted">Sem prioridade</span>
            )}
          </button>
        </PriorityPicker>
      </Row>

      <Row label="Início">
        <DateField
          label="Início"
          value={task.startAt}
          withTime={task.dueHasTime}
          icon={<CalendarPlus className="h-3.5 w-3.5 text-muted" aria-hidden="true" />}
          onChange={(startAt) => {
            onPatch({ startAt });
          }}
        />
      </Row>

      <Row label="Prazo">
        <DateField
          label="Prazo"
          value={task.dueAt}
          withTime={task.dueHasTime}
          icon={<CalendarClock className="h-3.5 w-3.5 text-muted" aria-hidden="true" />}
          onChange={(dueAt) => {
            onPatch({ dueAt });
          }}
        />
      </Row>

      <Row label="Com hora">
        <Switch
          checked={task.dueHasTime}
          aria-label="Usar hora nas datas da tarefa"
          onCheckedChange={(dueHasTime) => {
            onPatch({ dueHasTime });
          }}
        />
      </Row>

      <Row label="Estimativa">
        <NumberField
          label="Estimativa"
          value={durationInput(task.estimateMinutes)}
          format="Aceita 90, 90min, 1h30 ou 1:30"
          placeholder="1h30"
          parse={parseDuration}
          icon={<Timer className="h-3.5 w-3.5" aria-hidden="true" />}
          onCommit={(estimateMinutes) => {
            onPatch({ estimateMinutes });
          }}
        />
      </Row>

      <Row label="Pontos">
        <NumberField
          label="Pontos"
          value={task.points ? String(task.points) : ''}
          format="Número inteiro"
          placeholder="0"
          parse={(text) => {
            const trimmed = text.trim();

            if (trimmed === '') {
              return 0;
            }

            const parsed = Number(trimmed.replace(',', '.'));

            return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
          }}
          icon={<Hash className="h-3.5 w-3.5" aria-hidden="true" />}
          onCommit={(points) => {
            onPatch({ points });
          }}
        />
      </Row>

      <Row label="Tags">
        <TagPicker
          wsId={wsId}
          spaceId={spaceId}
          value={task.tagIds}
          onChange={(tagIds) => {
            onPatch({ tagIds });
          }}
        />
      </Row>

      <Row label="Tipo">
        <SelectNative
          id={typeId}
          aria-label="Tipo da tarefa"
          value={task.type}
          className="h-9 border-transparent bg-transparent text-[13px] hover:bg-surface-2"
          onChange={(event) => {
            onPatch({ type: event.target.value as TaskType });
          }}
        >
          {TASK_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectNative>
      </Row>

      <Row label="Recorrência">
        <RecurrenceField value={task.recurrence} disabled={false} onChange={onRecurrence} />
      </Row>

      <Row label="Tempo">
        <span className="px-1.5 text-[13px] text-body">
          {formatMinutes(task.trackedMinutes)}
          {task.estimateMinutes ? (
            <span className="text-muted"> de {formatMinutes(task.estimateMinutes)}</span>
          ) : null}
        </span>
      </Row>
    </dl>
  );
}
