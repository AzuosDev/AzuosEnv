import { useRouterState } from '@tanstack/react-router';
import { useEffect, useState, type ReactNode } from 'react';
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
          onOpenMenu={() => {
            setMenuOpen(true);
          }}
        />
        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden pb-24 md:pb-0">
          {children}
        </main>
      </div>

      <BottomNav wsId={wsId} activeId={navId} />

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" aria-describedby={undefined} className="lg:hidden">
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
