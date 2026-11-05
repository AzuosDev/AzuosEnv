import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface SettingsCardProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Cartão de uma área da configuração: título, apoio e conteúdo. */
export function SettingsCard({
  title,
  description,
  actions,
  children,
  className,
}: SettingsCardProps) {
  return (
    <section
      className={cn('rounded-2xl border border-line bg-surface p-4 md:p-5', className)}
      aria-label={title}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          {description ? <p className="mt-1 text-[13px] text-muted">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** Linha de item com texto à esquerda e controle à direita. */
export function SettingsRow({
  title,
  description,
  control,
  last = false,
}: {
  title: ReactNode;
  description?: ReactNode;
  control?: ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 py-3',
        !last && 'border-b border-line',
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-medium text-ink">{title}</p>
        {description ? <p className="mt-0.5 text-[12.5px] text-muted">{description}</p> : null}
      </div>
      {control}
    </div>
  );
}
