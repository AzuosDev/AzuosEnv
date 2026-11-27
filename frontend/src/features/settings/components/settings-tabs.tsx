import { Link } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import type { SettingsSection } from '../sections';

export interface SettingsTabsProps {
  wsId: string;
  /** Seção aberta, já com as abas que o papel vê. */
  section: SettingsSection;
  activeId: string;
  className?: string;
}

/**
 * Abas da seção aberta. Cada aba é uma rota, por isso são links e não Radix
 * Tabs. Seção de uma aba só não desenha barra alguma.
 */
export function SettingsTabs({ wsId, section, activeId, className }: SettingsTabsProps) {
  if (section.tabs.length < 2) {
    return null;
  }

  return (
    <nav
      aria-label={`Abas de ${section.label}`}
      className={cn('flex min-w-0 gap-1 overflow-x-auto border-b border-line', className)}
    >
      {section.tabs.map((tab) => {
        const active = tab.id === activeId;

        return (
          <Link
            key={tab.id}
            to={tab.to}
            params={{ wsId }}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-11 shrink-0 items-center rounded-t-lg border-b-2 px-3 text-[13px] font-medium no-underline',
              active ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
