import { Link } from '@tanstack/react-router';
import { ChevronRight, Folder } from 'lucide-react';
import type { TreeFolder, TreeList, TreeSpace, WorkspaceTree } from '@/api/types';
import { colorSwatch } from '@/lib/colors';
import { cn } from '@/lib/utils';
import type { ExpandedTree } from '../hooks/use-expanded';

export interface SidebarTreeProps {
  wsId: string;
  tree: WorkspaceTree;
  expanded: ExpandedTree;
  activeId: string | null;
  onNavigate?: () => void;
}

const rowClass =
  'flex min-h-11 flex-1 items-center gap-2 rounded-lg px-2 text-left text-[13px] text-body no-underline hover:bg-surface-2 hover:text-ink';

function Disclosure({
  name,
  open,
  onToggle,
}: {
  name: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`${open ? 'Recolher' : 'Expandir'} ${name}`}
      aria-expanded={open}
      onClick={onToggle}
      className="flex h-11 w-7 shrink-0 items-center justify-center rounded-lg bg-transparent text-muted hover:bg-surface-2 hover:text-ink"
    >
      <ChevronRight
        className={cn('h-4 w-4 transition-transform', open && 'rotate-90')}
        aria-hidden="true"
      />
    </button>
  );
}

function ListRow({
  wsId,
  list,
  active,
  onNavigate,
}: {
  wsId: string;
  list: TreeList;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <li>
      <Link
        to="/w/$wsId/l/$listId"
        params={{ wsId, listId: list.id }}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        className={cn(rowClass, 'ml-7', active && 'bg-accent/15 text-ink')}
      >
        <span className="min-w-0 flex-1 truncate">{list.name}</span>
        {list.openTaskCount > 0 ? (
          <span className="shrink-0 text-[12px] text-muted">{list.openTaskCount}</span>
        ) : null}
      </Link>
    </li>
  );
}

function FolderRow({
  wsId,
  folder,
  expanded,
  activeId,
  onNavigate,
}: {
  wsId: string;
  folder: TreeFolder;
  expanded: ExpandedTree;
  activeId: string | null;
  onNavigate?: () => void;
}) {
  const open = expanded.isExpanded(folder.id);
  const empty = folder.folders.length === 0 && folder.lists.length === 0;

  return (
    <li>
      <div className="flex items-center">
        <Disclosure
          name={folder.name}
          open={open}
          onToggle={() => {
            expanded.toggle(folder.id);
          }}
        />
        <Link
          to="/w/$wsId/f/$folderId"
          params={{ wsId, folderId: folder.id }}
          onClick={onNavigate}
          aria-current={activeId === folder.id ? 'page' : undefined}
          className={cn(rowClass, activeId === folder.id && 'bg-accent/15 text-ink')}
        >
          <Folder className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{folder.name}</span>
        </Link>
      </div>

      {open && !empty ? (
        <ul className="ml-3 flex flex-col gap-0.5 border-l border-line pl-1">
          {folder.folders.map((child) => (
            <FolderRow
              key={child.id}
              wsId={wsId}
              folder={child}
              expanded={expanded}
              activeId={activeId}
              {...(onNavigate ? { onNavigate } : {})}
            />
          ))}
          {folder.lists.map((list) => (
            <ListRow
              key={list.id}
              wsId={wsId}
              list={list}
              active={activeId === list.id}
              {...(onNavigate ? { onNavigate } : {})}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function SpaceRow({
  wsId,
  space,
  expanded,
  activeId,
  onNavigate,
}: {
  wsId: string;
  space: TreeSpace;
  expanded: ExpandedTree;
  activeId: string | null;
  onNavigate?: () => void;
}) {
  const open = expanded.isExpanded(space.id);
  const empty = space.folders.length === 0 && space.lists.length === 0;

  return (
    <li>
      <div className="flex items-center">
        <Disclosure
          name={space.name}
          open={open}
          onToggle={() => {
            expanded.toggle(space.id);
          }}
        />
        <Link
          to="/w/$wsId/s/$spaceId"
          params={{ wsId, spaceId: space.id }}
          onClick={onNavigate}
          aria-current={activeId === space.id ? 'page' : undefined}
          className={cn(
            rowClass,
            'font-semibold text-ink',
            activeId === space.id && 'bg-accent/15',
          )}
        >
          <span
            className={cn('h-2.5 w-2.5 shrink-0 rounded-[3px]', colorSwatch(space.color))}
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 truncate">{space.name}</span>
        </Link>
      </div>

      {open && !empty ? (
        <ul className="flex flex-col gap-0.5">
          {space.folders.map((folder) => (
            <FolderRow
              key={folder.id}
              wsId={wsId}
              folder={folder}
              expanded={expanded}
              activeId={activeId}
              {...(onNavigate ? { onNavigate } : {})}
            />
          ))}
          {space.lists.map((list) => (
            <ListRow
              key={list.id}
              wsId={wsId}
              list={list}
              active={activeId === list.id}
              {...(onNavigate ? { onNavigate } : {})}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** Árvore de Spaces, Folders e Lists do workspace. */
export function SidebarTree({ wsId, tree, expanded, activeId, onNavigate }: SidebarTreeProps) {
  return (
    <ul className="flex flex-col gap-0.5">
      {tree.spaces.map((space) => (
        <SpaceRow
          key={space.id}
          wsId={wsId}
          space={space}
          expanded={expanded}
          activeId={activeId}
          {...(onNavigate ? { onNavigate } : {})}
        />
      ))}
    </ul>
  );
}
