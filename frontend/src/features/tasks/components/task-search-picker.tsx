import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { queryKeys } from '@/api/keys';
import type { Task } from '@/api/types';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';
import { queryTasks } from '../api';

/** Letras mínimas antes de a busca sair. */
const MIN_QUERY = 2;
const DEBOUNCE_MS = 300;

export interface TaskSearchPickerProps {
  wsId: string;
  children: ReactNode;
  /** Restringe a busca a uma List (campo de relacionamento). */
  listId?: string;
  /** Tarefas que já estão escolhidas e não devem aparecer. */
  excludeIds?: string[];
  label?: string;
  onPick: (task: Task) => void;
}

/** Busca de tarefa por nome ou id, em popover, para ligar uma tarefa a outra. */
export function TaskSearchPicker({
  wsId,
  children,
  listId,
  excludeIds = [],
  label = 'Buscar tarefa',
  onPick,
}: TaskSearchPickerProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [term, setTerm] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setTerm(text.trim());
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [text]);

  const params = {
    q: term,
    limit: 10,
    groupBy: 'none' as const,
    includeClosed: true,
    ...(listId ? { location: 'list' as const, locationId: listId } : {}),
  };
  const results = useQuery({
    queryKey: queryKeys.tasks(wsId, params),
    queryFn: async () => (await queryTasks(wsId, params)).items ?? [],
    enabled: open && term.length >= MIN_QUERY,
    staleTime: 15_000,
  });

  const items = (results.data ?? []).filter((task) => !excludeIds.includes(task.id));

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);

        if (!next) {
          setText('');
          setTerm('');
        }
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 rounded-xl border border-line bg-surface px-2">
            <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <span className="sr-only">{label}</span>
            <Input
              autoFocus
              value={text}
              placeholder="Nome ou ID da tarefa"
              className="border-0 bg-transparent px-0 focus-visible:ring-0"
              onChange={(event) => {
                setText(event.target.value);
              }}
            />
          </label>

          {term.length < MIN_QUERY ? (
            <p className="px-1 text-[12.5px] text-muted">Digite ao menos duas letras.</p>
          ) : null}

          {results.isFetching ? <Spinner label="Buscando" /> : null}

          {term.length >= MIN_QUERY && !results.isFetching && items.length === 0 ? (
            <p className="px-1 text-[12.5px] text-muted">Nenhuma tarefa encontrada.</p>
          ) : null}

          <ul className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
            {items.map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] text-body hover:bg-surface-2 hover:text-ink md:min-h-9"
                  onClick={() => {
                    onPick(task);
                    setOpen(false);
                  }}
                >
                  <span className="shrink-0 text-[12px] text-muted">{task.customId}</span>
                  <span className="min-w-0 flex-1 truncate">{task.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  );
}
