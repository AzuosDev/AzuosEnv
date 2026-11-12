import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type StatusTone = 'neutral' | 'accent' | 'info' | 'success' | 'warning' | 'danger';

const toneClass: Record<StatusTone, string> = {
  neutral: 'border-line bg-surface-2 text-body',
  accent: 'border-scene-line bg-scene text-ink',
  info: 'border-info/40 bg-info/15 text-info',
  success: 'border-success/40 bg-success/15 text-success',
  warning: 'border-warning/40 bg-warning/15 text-warning',
  danger: 'border-danger/40 bg-danger/15 text-danger',
};

export interface StatusPillProps {
  children: ReactNode;
  tone?: StatusTone;
  className?: string;
}

/** Pílula de status; o tom vem sempre de um token. */
export function StatusPill({ children, tone = 'neutral', className }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold',
        toneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
