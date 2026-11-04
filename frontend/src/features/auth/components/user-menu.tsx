import { LogOut, MonitorSmartphone } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { AuthUser } from '@/api/types';
import { useLogout } from '../hooks/use-logout';

/** Menu da conta: identifica o usuário e encerra a sessão. */
export function UserMenu({ user }: { user: AuthUser }) {
  const logout = useLogout();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Conta"
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-line hover:bg-surface-2 md:h-10 md:w-10"
      >
        <Avatar name={user.name} {...(user.avatarUrl ? { src: user.avatarUrl } : {})} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <span className="block truncate text-ink">{user.name}</span>
          <span className="block truncate text-[12px] text-muted">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={logout.isPending}
          onSelect={() => {
            logout.mutate('current');
          }}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sair
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={logout.isPending}
          onSelect={() => {
            logout.mutate('all');
          }}
        >
          <MonitorSmartphone className="h-4 w-4" aria-hidden="true" />
          Sair de todos os dispositivos
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
