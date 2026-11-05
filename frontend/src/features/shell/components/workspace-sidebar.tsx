import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { CircleCheckBig, Inbox } from 'lucide-react';
import type { Workspace } from '@/api/types';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { inboxCountsQuery, treeQuery } from '../api';
import { useExpanded } from '../hooks/use-expanded';
import { ancestorIds, findLocation } from '../tree-path';
import { SidebarTree } from './sidebar-tree';
import { WorkspaceSwitcher } from './workspace-switcher';

export interface WorkspaceSidebarProps {
  wsId: string;
  workspaces: Workspace[];
  /** Space, Folder ou List aberto agora. */
  active: { kind: 'space' | 'folder' | 'list'; id: string } | null;
  onNavigate?: () => void;
}

const sectionLabel = 'px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted';

const homeRow =
  'flex min-h-11 items-center gap-2.5 rounded-lg px-2 text-[13px] text-body no-underline hover:bg-surface-2 hover:text-ink';

/** Sidebar do workspace: troca de workspace, Início e a árvore do /tree. */
export function WorkspaceSidebar({ wsId, workspaces, active, onNavigate }: WorkspaceSidebarProps) {
  const tree = useQuery(treeQuery(wsId));
  const counts = useQuery(inboxCountsQuery(wsId));
  const unread = counts.data?.unread ?? 0;
  const location = active ? findLocation(tree.data, active.kind, active.id) : null;
  const expanded = useExpanded(wsId, active ? [...ancestorIds(location), active.id] : []);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      <WorkspaceSwitcher
        wsId={wsId}
        workspaces={workspaces}
        {...(onNavigate ? { onNavigate } : {})}
      />

      <nav aria-label="Início" className="flex flex-col">
        <span className={sectionLabel}>Início</span>
        <Link to="/w/$wsId/inbox" params={{ wsId }} onClick={onNavigate} className={homeRow}>
          <Inbox className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">Inbox</span>
          {unread > 0 ? (
            <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-on-signal">
              {unread}
            </span>
          ) : null}
        </Link>
        <Link
          to="/w/$wsId/minhas-tarefas"
          params={{ wsId }}
          onClick={onNavigate}
          className={homeRow}
        >
          <CircleCheckBig className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">Minhas tarefas</span>
        </Link>
      </nav>

      <nav aria-label="Spaces" className="flex min-w-0 flex-col">
        <span className={sectionLabel}>Spaces</span>

        {tree.isPending ? (
          <div className="flex flex-col gap-2 px-2 py-1">
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} className={cn('h-7', row % 2 === 1 && 'ml-5 w-2/3')} />
            ))}
          </div>
        ) : null}

        {tree.isError ? (
          <p className="px-2 text-[13px] text-danger">Não foi possível carregar a árvore.</p>
        ) : null}

        {tree.data && tree.data.spaces.length === 0 ? (
          <EmptyState
            className="min-h-32 p-4"
            title="Nenhum Space ainda"
            description="Os Spaces do workspace aparecem aqui."
          />
        ) : null}

        {tree.data && tree.data.spaces.length > 0 ? (
          <SidebarTree
            wsId={wsId}
            tree={tree.data}
            expanded={expanded}
            activeId={active?.id ?? null}
            {...(onNavigate ? { onNavigate } : {})}
          />
        ) : null}
      </nav>
    </div>
  );
}
