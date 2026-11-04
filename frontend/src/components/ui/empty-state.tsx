import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Estado vazio sobre o palco (.stage) com a malha de pontos (.dot-grid). */
export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'stage relative flex min-h-56 flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-scene-line p-8 text-center',
        className,
      )}
    >
      <div className="dot-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      {icon ? <div className="relative text-accent">{icon}</div> : null}
      <p className="heading relative text-base">{title}</p>
      {description ? (
        <p className="relative max-w-sm text-[13px] text-muted">{description}</p>
      ) : null}
      {action ? <div className="relative pt-1">{action}</div> : null}
    </div>
  );
}
