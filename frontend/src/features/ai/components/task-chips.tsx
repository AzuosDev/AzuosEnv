import { Link } from '@tanstack/react-router';
import { CheckSquare } from 'lucide-react';
import type { TaskChip } from '../ai-events';

/** Tarefas citadas pela IA: cada chip abre a tarefa. */
export function TaskChips({ wsId, tasks }: { wsId: string; tasks: TaskChip[] }) {
  if (tasks.length === 0) {
    return null;
  }

  return (
    <ul aria-label="Tarefas citadas" className="flex flex-wrap gap-2">
      {tasks.map((task) => (
        <li key={task.id}>
          <Link
            to="/w/$wsId/t/$customId"
            params={{ wsId, customId: task.customId }}
            className="inline-flex max-w-[260px] items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] text-body hover:border-scene-line hover:text-ink"
          >
            <CheckSquare className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
            <span className="truncate">{task.name}</span>
            <span className="shrink-0 text-muted">{task.customId}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
