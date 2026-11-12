import { Link } from '@tanstack/react-router';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Workspace } from '@/api/types';
import { initials } from '@/lib/utils';

export interface WorkspaceSwitcherProps {
  wsId: string;
  workspaces: Workspace[];
  onNavigate?: () => void;
}

/** Troca de workspace no topo da sidebar. */
export function WorkspaceSwitcher({ wsId, workspaces, onNavigate }: WorkspaceSwitcherProps) {
  const current = workspaces.find((workspace) => workspace.id === wsId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left hover:bg-surface-2">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-scene-line bg-scene text-[11px] font-bold text-ink"
          aria-hidden="true"
        >
          {initials(current?.name ?? 'Azuos Env')}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-ink">
            {current?.name ?? 'Azuos Env'}
          </span>
          <span className="block truncate text-[12px] text-muted">{current?.taskPrefix}</span>
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        <span className="sr-only">Trocar de workspace</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        {workspaces.map((workspace) => (
          <DropdownMenuItem key={workspace.id} asChild>
            <Link
              to="/w/$wsId"
              params={{ wsId: workspace.id }}
              onClick={onNavigate}
              className="no-underline"
            >
              <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
              {workspace.id === wsId ? (
                <Check className="h-4 w-4 text-accent" aria-hidden="true" />
              ) : null}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/onboarding" onClick={onNavigate} className="no-underline">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Criar workspace
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
