import { Link } from '@tanstack/react-router';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { GoalTarget, GoalView, WorkspaceMemberItem } from '@/api/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { goalDueLabel, percentLabel, progressTone } from '../goal-model';
import { TargetRow } from './target-row';

export interface GoalCardProps {
  wsId: string;
  view: GoalView;
  members: WorkspaceMemberItem[];
  canWrite: boolean;
  onValue: (target: GoalTarget, current: number) => void;
}

const TONE_TEXT: Record<string, string> = {
  success: 'text-success',
  accent: 'text-accent',
  warning: 'text-warning',
  danger: 'text-danger',
};

const TONE_BAR: Record<string, string> = {
  success: 'bg-success',
  accent: 'bg-accent',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

/** Nomes dos donos, ou "Sem dono" quando a meta não tem ninguém. */
export function ownersLabel(view: GoalView, members: WorkspaceMemberItem[]): string {
  const names = view.goal.ownerIds
    .map((id) => members.find((member) => member.userId.id === id)?.userId.name)
    .filter((name): name is string => Boolean(name));

  return names.length === 0 ? 'Sem dono' : names.join(', ');
}

/** Cartão da meta: progresso, donos, prazo e os alvos que abrem no próprio cartão. */
export function GoalCard({ wsId, view, members, canWrite, onValue }: GoalCardProps) {
  const [open, setOpen] = useState(false);
  const tone = progressTone(view.progress);
  const due = goalDueLabel(view.goal);

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="min-w-0 break-words text-[17px] font-semibold text-ink">
            <Link
              to="/w/$wsId/metas/$goalId"
              params={{ wsId, goalId: view.goal.id }}
              className="text-ink no-underline hover:text-accent"
            >
              {view.goal.name}
            </Link>
          </h3>
          <span className="text-[12.5px] text-muted">
            {ownersLabel(view, members)}
            {due ? ` · prazo ${due}` : ''}
            {view.goal.completedAt ? ' · concluída' : ''}
          </span>
        </div>

        <span className={cn('text-2xl font-semibold', TONE_TEXT[tone])}>
          {percentLabel(view.progress)}
        </span>

        <Button
          variant="ghost"
          size="sm"
          aria-expanded={open}
          onClick={() => {
            setOpen((current) => !current);
          }}
        >
          {open ? (
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          )}
          {open ? 'Recolher alvos' : `Alvos (${String(view.targets.length)})`}
        </Button>
      </div>

      <div
        className="h-2 overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuenow={Math.round(view.progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progresso de ${view.goal.name}`}
      >
        <div
          className={cn('h-2 rounded-full', TONE_BAR[tone])}
          style={{ width: `${String(Math.min(100, view.progress))}%` }}
        />
      </div>

      {open ? (
        view.targets.length === 0 ? (
          <p className="border-t border-line pt-3 text-[13px] text-muted">
            Esta meta ainda não tem alvos.
          </p>
        ) : (
          <div className="flex flex-col">
            {view.targets.map((target) => (
              <TargetRow
                key={target.id}
                target={target}
                wsId={wsId}
                canWrite={canWrite}
                onValue={onValue}
              />
            ))}
          </div>
        )
      ) : null}
    </section>
  );
}
