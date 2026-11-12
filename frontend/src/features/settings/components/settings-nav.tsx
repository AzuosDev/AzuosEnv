import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import type { WorkspaceRole } from '@/api/types';
import { cn } from '@/lib/utils';
import { GROUP_LABELS, groupedSections } from '../sections';

export interface SettingsNavProps {
  wsId: string;
  role: WorkspaceRole;
  /** Seção aberta agora; null na lista. */
  activeId: string | null;
  className?: string;
}

/**
 * Abas da configuração. Acima de 768 px é a coluna lateral; abaixo, a lista que
 * leva para a tela de cada aba.
 */
export function SettingsNav({ wsId, role, activeId, className }: SettingsNavProps) {
  return (
    <nav aria-label="Seções de configuração" className={cn('flex flex-col gap-1', className)}>
      {groupedSections(role).map((entry) => (
        <div key={entry.group} className="flex flex-col gap-1">
          <span className="px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted">
            {GROUP_LABELS[entry.group]}
          </span>
          {entry.items.map((section) => {
            const active = section.id === activeId;

            return (
              <Link
                key={section.id}
                to={section.to}
                params={{ wsId }}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 items-center justify-between gap-2 rounded-lg px-2.5 text-[13.5px] no-underline',
                  active
                    ? 'bg-accent/15 font-semibold text-ink'
                    : 'text-body hover:bg-surface-2 hover:text-ink',
                )}
              >
                <span className="min-w-0 truncate">{section.label}</span>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-muted md:hidden"
                  aria-hidden="true"
                />
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
