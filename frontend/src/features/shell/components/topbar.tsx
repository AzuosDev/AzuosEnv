import { Menu, WifiOff } from 'lucide-react';
import type { RefObject } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import type { AuthUser } from '@/api/types';
import { AiDrawer } from '@/features/ai/components/ai-drawer';
import { UserMenu } from '@/features/auth/components/user-menu';
import { useSocket } from '@/features/realtime/socket';
import { CommandPalette } from '@/features/search/components/command-palette';
import { NewTaskButton } from '@/features/tasks/components/new-task-dialog';
import { TimerSlot } from './timer-slot';

export interface TopbarProps {
  wsId: string;
  user: AuthUser | null;
  onOpenMenu: () => void;
  /** O drawer devolve o foco para este botão ao fechar. */
  menuRef?: RefObject<HTMLButtonElement | null>;
}

/** Aviso discreto de tempo real caído; some sozinho quando o socket volta. */
function ConnectionBadge() {
  const { connected } = useSocket();

  if (connected) {
    return null;
  }

  return (
    <span
      role="status"
      aria-label="Sem conexão em tempo real"
      title="Sem conexão em tempo real"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-warning"
    >
      <WifiOff className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}

/** Topbar: busca, timer ativo, tema e conta. */
export function Topbar({ wsId, user, onOpenMenu, menuRef }: TopbarProps) {
  return (
    <header className="flex items-center gap-2 border-b border-line bg-paper px-3 py-2.5 md:gap-3 md:px-6">
      <Button
        ref={menuRef}
        variant="ghost"
        size="icon"
        aria-label="Abrir navegação"
        className="shrink-0 lg:hidden"
        onClick={onOpenMenu}
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </Button>

      <CommandPalette wsId={wsId} />
      <TimerSlot wsId={wsId} />

      <div className="flex-1" />

      <NewTaskButton wsId={wsId} />
      <AiDrawer wsId={wsId} />
      <ConnectionBadge />
      <ThemeToggle className="hidden md:inline-flex" />
      {user ? <UserMenu user={user} wsId={wsId} /> : null}
    </header>
  );
}
