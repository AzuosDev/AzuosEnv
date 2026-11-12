import { Plus } from 'lucide-react';
import { useState } from 'react';
import type { CreateTaskInput } from '@/api/types';
import { cn } from '@/lib/utils';
import { groupPatch } from '../task-fields';
import type { ViewSurfaceProps } from './view-surface';

export interface QuickAddProps {
  /** Grupo onde a tarefa nasce; null nas views sem agrupamento. */
  groupKey: string | null;
  surface: ViewSurfaceProps;
  label: string;
  className?: string;
}

/** "+ Adicionar tarefa": o campo nasce no grupo e some no Esc ou sem texto. */
export function QuickAdd({ groupKey, surface, label, className }: QuickAddProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  if (!surface.canEdit) {
    return null;
  }

  const submit = (): void => {
    const trimmed = name.trim();

    if (trimmed === '') {
      setOpen(false);

      return;
    }

    const seed = groupKey === null ? null : groupPatch(surface.groupBy, groupKey);

    surface.actions.create.mutate({ body: { name: trimmed, ...seed } as CreateTaskInput });
    setName('');
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
      className={cn('px-2 py-1 md:px-3', className)}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label className="sr-only" htmlFor={`quick-add-${groupKey ?? 'all'}`}>
        Nome da nova tarefa
      </label>
      <input
        id={`quick-add-${groupKey ?? 'all'}`}
        autoFocus
        value={name}
        placeholder="Nome da tarefa e Enter"
        onChange={(event) => {
          setName(event.target.value);
        }}
        onBlur={submit}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setName('');
            setOpen(false);
          }
        }}
        className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-[13.5px] text-ink outline-none md:h-10"
      />
    </form>
  );
}
