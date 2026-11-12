import { Flag } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Priority = 'urgent' | 'high' | 'normal' | 'low';

const priorityLabel: Record<Priority, string> = {
  urgent: 'Urgente',
  high: 'Alta',
  normal: 'Normal',
  low: 'Baixa',
};

const priorityClass: Record<Priority, string> = {
  urgent: 'text-danger',
  high: 'text-warning',
  normal: 'text-info',
  low: 'text-muted',
};

export interface PriorityFlagProps {
  priority: Priority | null;
  withLabel?: boolean;
  className?: string;
}

/** Bandeira de prioridade da tarefa. */
export function PriorityFlag({ priority, withLabel = false, className }: PriorityFlagProps) {
  const label = priority ? priorityLabel[priority] : 'Sem prioridade';

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[12px]', className)}>
      <Flag
        className={cn('h-4 w-4', priority ? priorityClass[priority] : 'text-muted')}
        aria-hidden="true"
      />
      {withLabel ? (
        <span className="text-body">{label}</span>
      ) : (
        <span className="sr-only">{label}</span>
      )}
    </span>
  );
}
