import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { Link } from '@tanstack/react-router';
import { ChevronRight, Folder, GripVertical } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { TreeFolder, TreeList, TreeSpace, WorkspaceTree } from '@/api/types';
import { AddMenu, NodeMenu } from '@/features/hierarchy/components/node-menu';
import { useDropNode } from '@/features/hierarchy/hooks/use-hierarchy-actions';
import { iconOf } from '@/features/hierarchy/node-kinds';
import { flattenTree, planDrop, type FlatNode } from '@/features/hierarchy/tree-dnd';
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
  'flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-left text-[13px] text-body no-underline hover:bg-surface-2 hover:text-ink';

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

/**
 * Linha arrastável da árvore: a alça só aparece no mouse (acima de 768 px); no
 * celular o caminho é o item "Mover" do menu.
 */
function Row({ node, children, indent }: { node: FlatNode; children: ReactNode; indent?: string }) {
  const sortable = useSortable({ id: node.id, animateLayoutChanges: () => false });

  return (
    <div
      ref={sortable.setNodeRef}
      className={cn(
        'group flex items-center rounded-lg',
        indent,
        sortable.isDragging && 'opacity-40',
        sortable.isOver && !sortable.isDragging && 'bg-accent/10 ring-1 ring-accent',
      )}
    >
      <button
        type="button"
        aria-label={`Reordenar ${node.name}`}
        className="hidden h-9 w-5 shrink-0 cursor-grab items-center justify-center rounded-lg text-muted opacity-0 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 md:flex"
        {...sortable.attributes}
        {...sortable.listeners}
      >
        <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {children}
    </div>
  );
}

function Actions({ node }: { node: FlatNode }) {
  return (
    <span className="flex shrink-0 items-center transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100 md:has-[[data-state=open]]:opacity-100">
      <AddMenu node={node} size="sm" className="hidden md:flex" />
      <NodeMenu node={node} size="sm" includeCreate />
    </span>
  );
}

function ListRow({
  wsId,
  list,
  node,
  active,
  onNavigate,
}: {
  wsId: string;
  list: TreeList;
  node: FlatNode;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <li>
      <Row node={node} indent="ml-7">
        <Link
          to="/w/$wsId/l/$listId"
          params={{ wsId, listId: list.id }}
          onClick={onNavigate}
          aria-current={active ? 'page' : undefined}
          className={cn(rowClass, active && 'bg-accent/15 text-ink')}
        >
          <span className="min-w-0 flex-1 truncate">{list.name}</span>
          {list.openTaskCount > 0 ? (
            <span className="shrink-0 text-[12px] text-muted">{list.openTaskCount}</span>
          ) : null}
        </Link>
        <Actions node={node} />
      </Row>
    </li>
  );
}

function FolderRow({
  wsId,
  folder,
  spaceId,
  parentFolderId,
  expanded,
  activeId,
  onNavigate,
}: {
  wsId: string;
  folder: TreeFolder;
  spaceId: string;
  parentFolderId: string | null;
  expanded: ExpandedTree;
  activeId: string | null;
  onNavigate?: () => void;
}) {
  const open = expanded.isExpanded(folder.id);
  const empty = folder.folders.length === 0 && folder.lists.length === 0;
  const node: FlatNode = {
    id: folder.id,
    kind: 'folder',
    name: folder.name,
    depth: parentFolderId ? 2 : 1,
    spaceId,
    folderId: parentFolderId,
  };

  return (
    <li>
      <Row node={node}>
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
        <Actions node={node} />
      </Row>

      {open && !empty ? (
        <ul className="ml-3 flex flex-col gap-0.5 border-l border-line pl-1">
          {folder.folders.map((child) => (
            <FolderRow
              key={child.id}
              wsId={wsId}
              folder={child}
              spaceId={spaceId}
              parentFolderId={folder.id}
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
              node={{
                id: list.id,
                kind: 'list',
                name: list.name,
                depth: 2,
                spaceId,
                folderId: folder.id,
              }}
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
  const Icon = iconOf(space.icon);
  const node: FlatNode = {
    id: space.id,
    kind: 'space',
    name: space.name,
    depth: 0,
    spaceId: space.id,
    folderId: null,
  };

  return (
    <li>
      <Row node={node}>
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
          {Icon ? (
            <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          ) : (
            <span
              className={cn('h-2.5 w-2.5 shrink-0 rounded-[3px]', colorSwatch(space.color))}
              aria-hidden="true"
            />
          )}
          <span className="min-w-0 flex-1 truncate">{space.name}</span>
        </Link>
        <Actions node={node} />
      </Row>

      {open && !empty ? (
        <ul className="flex flex-col gap-0.5">
          {space.folders.map((folder) => (
            <FolderRow
              key={folder.id}
              wsId={wsId}
              folder={folder}
              spaceId={space.id}
              parentFolderId={null}
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
              node={{
                id: list.id,
                kind: 'list',
                name: list.name,
                depth: 1,
                spaceId: space.id,
                folderId: null,
              }}
              active={activeId === list.id}
              {...(onNavigate ? { onNavigate } : {})}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * No mouse vale a linha sob o ponteiro; no teclado (sem ponteiro) cai no vizinho
 * mais próximo.
 */
const collisionDetection: CollisionDetection = (args) => {
  const underPointer = pointerWithin(args);

  return underPointer.length > 0 ? underPointer : closestCenter(args);
};

/** Árvore de Spaces, Folders e Lists do workspace, com arrastar para reordenar. */
export function SidebarTree({ wsId, tree, expanded, activeId, onNavigate }: SidebarTreeProps) {
  const nodes = flattenTree(tree, expanded.isExpanded);
  const drop = useDropNode(wsId);
  const [dragging, setDragging] = useState<FlatNode | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragStart = (event: DragStartEvent): void => {
    setDragging(nodes.find((node) => node.id === String(event.active.id)) ?? null);
  };

  const onDragEnd = (event: DragEndEvent): void => {
    setDragging(null);

    if (!event.over) {
      return;
    }

    const plan = planDrop(nodes, String(event.active.id), String(event.over.id));

    if (plan) {
      drop.mutate(plan);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setDragging(null);
      }}
    >
      <SortableContext items={nodes.map((node) => node.id)}>
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
      </SortableContext>

      <DragOverlay dropAnimation={null}>
        {dragging ? (
          <span className="rounded-lg border border-accent bg-surface px-2 py-1 text-[13px] text-ink shadow-xl">
            {dragging.name}
          </span>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
