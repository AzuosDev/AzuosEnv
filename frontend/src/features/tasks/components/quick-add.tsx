import { CalendarDays, Flag, ImagePlus, Plus, UserRound, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { errorMessage } from '@/api/errors';
import type { CreateTaskInput, TaskPriority } from '@/api/types';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { uploadAttachment } from '../collaboration-api';
import { PRIORITY_LABEL, formatDue, groupPatch } from '../task-fields';
import { AssigneesPicker, DuePicker, PriorityPicker } from './task-pickers';
import type { ViewSurfaceProps } from './view-surface';

export interface QuickAddProps {
  groupKey: string | null;
  surface: ViewSurfaceProps;
  label: string;
  className?: string;
}

/** Inline task creation: only the name is required. */
export function QuickAdd({ groupKey, surface, label, className }: QuickAddProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [priority, setPriority] = useState<TaskPriority | null>(null);
  const [dueAt, setDueAt] = useState<string | null>(null);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  if (!surface.canEdit) {
    return null;
  }

  const reset = (): void => {
    setName('');
    setAssigneeIds([]);
    setPriority(null);
    setDueAt(null);
    setScreenshot(null);
  };

  const submit = (): void => {
    const trimmed = name.trim();

    if (trimmed === '') {
      return;
    }

    const seed = groupKey === null ? null : groupPatch(surface.groupBy, groupKey);
    const file = screenshot;

    void surface.actions.create
      .mutateAsync({
        body: {
          name: trimmed,
          ...seed,
          allowIncompleteRequiredFields: true,
          ...(assigneeIds.length > 0 ? { assigneeIds } : {}),
          ...(priority ? { priority } : {}),
          ...(dueAt ? { dueAt } : {}),
        } as CreateTaskInput,
      })
      .then(async (task) => {
        reset();

        if (file) {
          try {
            await uploadAttachment(surface.wsId, task.customId, file);
          } catch (error) {
            toast.error(errorMessage(error, 'A tarefa foi criada, mas o print não foi anexado.'));
          }
        }
      })
      .catch(() => {
        // The mutation displays the error and preserves the draft.
      });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
        className={cn(
          'flex min-h-11 w-full items-center gap-1.5 px-2 text-left text-[13px] text-muted hover:text-ink md:min-h-10 md:px-3',
          className,
        )}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        {label}
      </button>
    );
  }

  return (
    <form
      className={cn('rounded-lg border border-accent/70 bg-surface p-2 md:p-2.5', className)}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      onPaste={(event) => {
        const image = [...event.clipboardData.files].find((file) => file.type.startsWith('image/'));

        if (image) {
          event.preventDefault();
          setScreenshot(image);
        }
      }}
    >
      <div className="flex gap-2">
        <label className="sr-only" htmlFor={`quick-add-${groupKey ?? 'all'}`}>
          Nome da nova tarefa
        </label>
        <input
          id={`quick-add-${groupKey ?? 'all'}`}
          autoFocus
          value={name}
          placeholder="Nome da tarefa..."
          onChange={(event) => {
            setName(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              reset();
              setOpen(false);
            }
          }}
          className="h-9 min-w-0 flex-1 rounded-md border border-line bg-canvas px-2 text-[13px] text-ink outline-none focus-visible:border-accent"
        />
        <Button
          type="submit"
          size="sm"
          disabled={name.trim() === '' || surface.actions.create.isPending}
        >
          Salvar
        </Button>
      </div>

      <div className="mt-1.5 flex flex-col gap-1">
        <AssigneesPicker
          members={surface.members}
          value={assigneeIds}
          onChange={setAssigneeIds}
          disabled={surface.actions.create.isPending}
          align="start"
        >
          <button
            type="button"
            className="flex h-8 items-center gap-2 rounded-md px-2 text-[12.5px] text-muted hover:bg-surface-2 hover:text-ink"
          >
            <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
            {assigneeIds.length === 0
              ? 'Adicionar responsável'
              : `${String(assigneeIds.length)} responsável(is)`}
          </button>
        </AssigneesPicker>

        <PriorityPicker
          value={priority}
          onSelect={setPriority}
          disabled={surface.actions.create.isPending}
          align="start"
        >
          <button
            type="button"
            className="flex h-8 items-center gap-2 rounded-md px-2 text-[12.5px] text-muted hover:bg-surface-2 hover:text-ink"
          >
            <Flag className="h-3.5 w-3.5" aria-hidden="true" />
            {priority ? `Prioridade: ${PRIORITY_LABEL[priority]}` : 'Adicionar prioridade'}
          </button>
        </PriorityPicker>

        <DuePicker
          value={dueAt}
          onChange={setDueAt}
          disabled={surface.actions.create.isPending}
          align="start"
        >
          <button
            type="button"
            className="flex h-8 items-center gap-2 rounded-md px-2 text-[12.5px] text-muted hover:bg-surface-2 hover:text-ink"
          >
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            {dueAt ? `Prazo: ${formatDue(dueAt)}` : 'Adicionar prazo'}
          </button>
        </DuePicker>

        <div className="flex min-w-0 items-center gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label="Selecionar print para anexar"
            disabled={surface.actions.create.isPending}
            onChange={(event) => {
              setScreenshot(event.target.files?.[0] ?? null);
              event.target.value = '';
            }}
          />
          <button
            type="button"
            disabled={surface.actions.create.isPending}
            className="flex h-8 items-center gap-2 rounded-md px-2 text-[12.5px] text-muted hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-45"
            onClick={() => {
              fileInput.current?.click();
            }}
          >
            <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
            {screenshot ? 'Trocar print' : 'Adicionar print'}
          </button>
          {screenshot ? (
            <span className="flex min-w-0 items-center gap-1 text-[12px] text-body">
              <span className="min-w-0 truncate">{screenshot.name || 'Print selecionado'}</span>
              <button
                type="button"
                aria-label="Remover print anexado"
                disabled={surface.actions.create.isPending}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-ink"
                onClick={() => {
                  setScreenshot(null);
                }}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </span>
          ) : null}
        </div>
      </div>
    </form>
  );
}
