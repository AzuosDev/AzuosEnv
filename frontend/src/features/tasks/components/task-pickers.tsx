import { Check, X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { EffectiveStatus, TaskPriority, WorkspaceMemberItem } from '@/api/types';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PriorityFlag } from '@/components/ui/priority-flag';
import { StatusPill } from '@/components/ui/status-pill';
import { cn } from '@/lib/utils';
import { PRIORITY_ORDER, statusTone } from '../task-fields';
import { isoToDay } from '@/features/views/filters';

const itemClass =
  'flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] text-body hover:bg-surface-2 hover:text-ink md:min-h-9';

export interface PickerProps {
  children: ReactNode;
  disabled?: boolean;
  align?: 'start' | 'center' | 'end';
}

function Picker({
  children,
  content,
  disabled,
  align = 'start',
  width,
}: PickerProps & { content: ReactNode; width?: string }) {
  if (disabled) {
    return <>{children}</>;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align={align} className={cn('max-h-80 overflow-y-auto', width)}>
        {content}
      </PopoverContent>
    </Popover>
  );
}

/** Troca o status da tarefa; a lista é a do conjunto efetivo da List. */
export function StatusPicker({
  statuses,
  value,
  onSelect,
  children,
  disabled,
  align,
}: PickerProps & {
  statuses: EffectiveStatus[];
  value: string | undefined;
  onSelect: (statusId: string) => void;
}) {
  return (
    <Picker
      disabled={disabled}
      align={align}
      content={
        <div className="flex flex-col gap-0.5">
          {statuses.map((status) => (
            <button
              key={status.id}
              type="button"
              className={itemClass}
              onClick={() => {
                onSelect(status.id);
              }}
            >
              <StatusPill tone={statusTone(status.group, status.color)}>{status.name}</StatusPill>
              {status.id === value ? (
                <Check className="ml-auto h-4 w-4 text-accent" aria-hidden="true" />
              ) : null}
            </button>
          ))}
        </div>
      }
    >
      {children}
    </Picker>
  );
}

/** Responsáveis da tarefa: cada pessoa do workspace entra ou sai da lista. */
export function AssigneesPicker({
  members,
  value,
  onChange,
  children,
  disabled,
  align,
}: PickerProps & {
  members: WorkspaceMemberItem[];
  value: string[];
  onChange: (assigneeIds: string[]) => void;
}) {
  return (
    <Picker
      disabled={disabled}
      align={align}
      content={
        <div className="flex flex-col gap-0.5">
          {members.length === 0 ? (
            <p className="px-2 py-2 text-[13px] text-muted">Ninguém para atribuir.</p>
          ) : null}
          {members.map((member) => {
            const id = member.userId.id;
            const picked = value.includes(id);

            return (
              <button
                key={member.id}
                type="button"
                aria-pressed={picked}
                className={itemClass}
                onClick={() => {
                  onChange(picked ? value.filter((item) => item !== id) : [...value, id]);
                }}
              >
                <Avatar
                  name={member.userId.name}
                  src={member.userId.avatarUrl}
                  className="h-6 w-6"
                />
                <span className="truncate">{member.userId.name}</span>
                {picked ? (
                  <Check className="ml-auto h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                ) : null}
              </button>
            );
          })}
        </div>
      }
    >
      {children}
    </Picker>
  );
}

/** Prioridade, com a opção de limpar. */
export function PriorityPicker({
  value,
  onSelect,
  children,
  disabled,
  align,
}: PickerProps & {
  value: TaskPriority | null;
  onSelect: (priority: TaskPriority | null) => void;
}) {
  return (
    <Picker
      disabled={disabled}
      align={align}
      width="w-56"
      content={
        <div className="flex flex-col gap-0.5">
          {PRIORITY_ORDER.map((priority) => (
            <button
              key={priority}
              type="button"
              className={itemClass}
              onClick={() => {
                onSelect(priority);
              }}
            >
              <PriorityFlag priority={priority} withLabel />
              {priority === value ? (
                <Check className="ml-auto h-4 w-4 text-accent" aria-hidden="true" />
              ) : null}
            </button>
          ))}
          <button
            type="button"
            className={itemClass}
            onClick={() => {
              onSelect(null);
            }}
          >
            <X className="h-4 w-4 text-muted" aria-hidden="true" />
            Sem prioridade
          </button>
        </div>
      }
    >
      {children}
    </Picker>
  );
}

/** Prazo por data nativa; o botão Limpar tira a data. */
export function DuePicker({
  value,
  onChange,
  children,
  disabled,
  align,
}: PickerProps & { value: string | null; onChange: (dueAt: string | null) => void }) {
  return (
    <Picker
      disabled={disabled}
      align={align}
      width="w-64"
      content={
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-body">
            Prazo
            <input
              type="date"
              value={isoToDay(value ?? undefined)}
              onChange={(event) => {
                const day = event.target.value;

                onChange(day === '' ? null : new Date(`${day}T12:00:00`).toISOString());
              }}
              className="h-11 rounded-xl border border-line bg-surface px-3 text-ink outline-none md:h-10"
            />
          </label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange(null);
            }}
          >
            Limpar prazo
          </Button>
        </div>
      }
    >
      {children}
    </Picker>
  );
}
