import { useQuery } from '@tanstack/react-query';
import { errorMessage } from '@/api/errors';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { StatusPill } from '@/components/ui/status-pill';
import { FormAlert } from '@/features/auth/components/field';
import { approvalsQuery } from '../api';
import { useTimesheetActions } from '../hooks/use-timesheet';
import { formatCellHours } from '../timesheet-model';
import { weekRangeLabel } from '../week';

export interface ApprovalsTabProps {
  wsId: string;
}

/** Semanas enviadas esperando decisão do admin. */
export function ApprovalsTab({ wsId }: ApprovalsTabProps) {
  const approvals = useQuery(approvalsQuery(wsId, true));
  const actions = useTimesheetActions(wsId);

  if (approvals.isPending) {
    return <Skeleton className="h-40" />;
  }

  if (approvals.isError) {
    return <FormAlert>{errorMessage(approvals.error)}</FormAlert>;
  }

  if (approvals.data.length === 0) {
    return (
      <EmptyState
        title="Nada para aprovar"
        description="As semanas enviadas pela equipe aparecem aqui para você aprovar ou recusar."
      />
    );
  }

  return (
    <ul className="flex min-w-0 max-w-[880px] flex-col gap-2.5">
      {approvals.data.map((item) => (
        <li
          key={`${item.userId}:${item.weekStart}`}
          className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-4"
        >
          <div className="flex min-w-0 flex-1 basis-[240px] flex-col">
            <span className="truncate font-semibold text-ink">{item.name}</span>
            <span className="text-[12.5px] text-muted">
              {weekRangeLabel(item.weekStart)} · {formatCellHours(item.totalMinutes)} ·{' '}
              {formatCellHours(item.billableMinutes)} faturáveis
            </span>
          </div>

          <StatusPill tone="warning">Aguardando</StatusPill>

          <Button
            variant="ghost"
            size="sm"
            disabled={actions.review.isPending}
            onClick={() => {
              actions.review.mutate({
                decision: 'reject',
                userId: item.userId,
                weekStart: item.weekStart,
              });
            }}
          >
            Recusar
          </Button>
          <Button
            size="sm"
            disabled={actions.review.isPending}
            onClick={() => {
              actions.review.mutate({
                decision: 'approve',
                userId: item.userId,
                weekStart: item.weekStart,
              });
            }}
          >
            {actions.review.isPending ? <Spinner label="Decidindo" /> : 'Aprovar'}
          </Button>
        </li>
      ))}
    </ul>
  );
}
