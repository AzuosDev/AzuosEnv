import { useRouterState } from '@tanstack/react-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Workspace } from '@/api/types';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useSession } from '@/features/auth/session';
import { activeNavId, activeTreeTarget } from '../nav-active';
import { BottomNav } from './bottom-nav';
import { NavRail } from './nav-rail';
import { Topbar } from './topbar';
import { WorkspaceSidebar } from './workspace-sidebar';

export interface AppShellProps {
  wsId: string;
  workspaces: Workspace[];
  children: ReactNode;
}

/**
 * Shell do workspace: rail dos módulos, sidebar da hierarquia, topbar e o
 * conteúdo da rota. Abaixo de 1024 px a sidebar vira drawer; abaixo de 768 px o
 * rail dá lugar à barra inferior.
 */
export function AppShell({ wsId, workspaces, children }: AppShellProps) {
  const user = useSession();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const navId = activeNavId(pathname, wsId);
  const active = activeTreeTarget(pathname, wsId);

  // O drawer fecha sozinho ao navegar.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const closeMenu = (): void => {
    setMenuOpen(false);
  };

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      <a
        href="#conteudo"
        /* O not-sr-only zera o padding: o foco devolve o respiro e a altura. */
        className="sr-only left-3 top-3 z-50 rounded-xl bg-surface-2 text-[13px] font-semibold text-ink shadow-lg ring-2 ring-accent focus:not-sr-only focus:fixed focus:flex focus:h-11 focus:items-center focus:px-4 focus:py-2"
      >
        Pular para o conteúdo
      </a>
      <NavRail wsId={wsId} activeId={navId} />

      <aside
        aria-label="Navegação do workspace"
        className="hidden w-[264px] shrink-0 flex-col border-r border-line bg-paper-2 p-3 lg:flex"
      >
        <WorkspaceSidebar wsId={wsId} workspaces={workspaces} active={active} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar
          wsId={wsId}
          user={user}
          menuRef={menuRef}
          onOpenMenu={() => {
            setMenuOpen(true);
          }}
        />
        <main
          id="conteudo"
          tabIndex={-1}
          className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden pb-24 outline-none md:pb-0"
        >
          {children}
        </main>
      </div>

      <BottomNav wsId={wsId} activeId={navId} />

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          side="left"
          aria-describedby={undefined}
          className="lg:hidden"
          onCloseAutoFocus={(event) => {
            // Sem isto o foco cai no body: o drawer é controlado, sem Trigger.
            event.preventDefault();
            menuRef.current?.focus();
          }}
        >
          <SheetTitle className="sr-only">Navegação do workspace</SheetTitle>
          <WorkspaceSidebar
            wsId={wsId}
            workspaces={workspaces}
            active={active}
            onNavigate={closeMenu}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
