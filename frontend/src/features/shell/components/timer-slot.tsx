import { Link } from '@tanstack/react-router';
import { Square } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { taskQuery } from '@/features/tasks/api';
import { useTick, useTimer } from '@/features/tasks/hooks/use-timer';
import { elapsedSeconds, formatStopwatch } from '@/features/tasks/time-fields';

export interface TimerSlotProps {
  wsId: string;
}

/**
 * Cronômetro ativo na topbar: tempo correndo, link para a tarefa e parar. Sem
 * cronômetro aberto nada é desenhado e o espaço não ocupa largura.
 */
export function TimerSlot({ wsId }: TimerSlotProps) {
  const { running, stop, pending } = useTimer(wsId);
  const now = useTick(Boolean(running));
  const task = useQuery({
    ...taskQuery(wsId, running?.taskId ?? ''),
    enabled: Boolean(running?.taskId),
  });

  if (!running) {
    return <div data-slot="timer" className="contents" aria-hidden="true" />;
  }

  const seconds = elapsedSeconds(running.start, now);

  return (
    <div
      data-slot="timer"
      className="flex min-w-0 items-center gap-1 rounded-xl border border-line bg-surface px-1.5 py-1"
    >
      <span
        role="timer"
        aria-label={`Cronômetro em andamento: ${formatStopwatch(seconds)}`}
        className="shrink-0 font-mono text-[12.5px] font-semibold tabular-nums text-accent"
      >
        {formatStopwatch(seconds)}
      </span>

      {task.data ? (
        <Link
          to="/w/$wsId/t/$customId"
          params={{ wsId, customId: task.data.customId }}
          className="hidden max-w-[160px] truncate text-[12.5px] text-body hover:text-ink md:block"
        >
          {task.data.name}
        </Link>
      ) : null}

      <Button
        variant="nav"
        size="icon"
        aria-label="Parar cronômetro"
        disabled={pending}
        className="h-8 w-8 shrink-0"
        onClick={stop}
      >
        <Square className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>
    </div>
  );
}
