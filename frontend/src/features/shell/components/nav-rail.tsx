import { Link } from '@tanstack/react-router';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { NAV_ITEMS, SETTINGS_ITEM, type NavItem } from '../nav-items';

function RailLink({ item, wsId, active }: { item: NavItem; wsId: string; active: boolean }) {
  const Icon = item.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to={item.to}
          params={{ wsId }}
          aria-label={item.label}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-lg text-body no-underline hover:bg-surface-2 hover:text-ink',
            active && 'bg-accent/15 text-ink',
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

/** Rail de 64 px com os módulos; abaixo de 768 px dá lugar à barra inferior. */
export function NavRail({ wsId, activeId }: { wsId: string; activeId: string | null }) {
  return (
    <nav
      aria-label="Navegação global"
      className="hidden w-16 shrink-0 flex-col items-center gap-1.5 border-r border-line bg-paper-2 py-3.5 md:flex"
    >
      <Link
        to="/w/$wsId"
        params={{ wsId }}
        aria-label="Azuos Env — início"
        className="btn-signal mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl text-[13px] font-bold no-underline"
      >
        &lt;/&gt;
      </Link>

      {NAV_ITEMS.map((item) => (
        <RailLink key={item.id} item={item} wsId={wsId} active={activeId === item.id} />
      ))}

      <span className="flex-1" />

      <RailLink item={SETTINGS_ITEM} wsId={wsId} active={activeId === SETTINGS_ITEM.id} />
    </nav>
  );
}
