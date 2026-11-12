import { Link } from '@tanstack/react-router';
import { MoreHorizontal } from 'lucide-react';
import { useState } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { BOTTOM_NAV_ITEMS, MORE_NAV_ITEMS } from '../nav-items';

const itemClass =
  'flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-[11px] text-muted no-underline';

/** Navegação global abaixo de 768 px: quatro módulos e "Mais". */
export function BottomNav({ wsId, activeId }: { wsId: string; activeId: string | null }) {
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <nav
        aria-label="Navegação global"
        className="fixed inset-x-0 bottom-0 z-30 flex items-stretch gap-1 border-t border-line bg-paper-2 px-2 pb-[max(env(safe-area-inset-bottom),6px)] pt-1.5 md:hidden"
      >
        {BOTTOM_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeId === item.id;

          return (
            <Link
              key={item.id}
              to={item.to}
              params={{ wsId }}
              aria-current={active ? 'page' : undefined}
              className={cn(itemClass, active && 'bg-accent/15 text-ink')}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}

        <button
          type="button"
          aria-label="Mais"
          aria-expanded={moreOpen}
          onClick={() => {
            setMoreOpen(true);
          }}
          className={cn(itemClass, 'bg-transparent')}
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
          Mais
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" aria-describedby={undefined}>
          <SheetTitle className="heading pr-10 text-base">Mais</SheetTitle>
          <ul className="flex flex-col gap-1">
            {MORE_NAV_ITEMS.map((item) => {
              const Icon = item.icon;

              return (
                <li key={item.id}>
                  <Link
                    to={item.to}
                    params={{ wsId }}
                    onClick={() => {
                      setMoreOpen(false);
                    }}
                    className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-body no-underline hover:bg-surface-2 hover:text-ink"
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
            <span className="text-[13px] text-muted">Tema</span>
            <ThemeToggle />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
