import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { ChevronDown, ChevronRight, FileText, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { Fragment, useState } from 'react';
import type { DocPage } from '@/api/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { buildPageTree, flattenTree, type DropPosition, type PageRow } from '../page-tree';

export interface PageTreePanelProps {
  pages: DocPage[];
  activeId: string | undefined;
  canEdit: boolean;
  onPick: (pageId: string) => void;
  onCreate: (parentPageId: string | null) => void;
  onRename: (pageId: string, title: string) => void;
  onDelete: (pageId: string) => void;
  onMove: (activeId: string, overId: string, position: DropPosition) => void;
}

/** No mouse vale a linha sob o ponteiro; no teclado cai no vizinho mais próximo. */
const collisionDetection: CollisionDetection = (args) => {
  const underPointer = pointerWithin(args);

  return underPointer.length > 0 ? underPointer : closestCenter(args);
};

function parseTarget(id: string): { position: DropPosition; pageId: string } | null {
  const [position, pageId] = id.split(':');

  if (pageId === undefined || (position !== 'before' && position !== 'inside')) {
    return null;
  }

  return { position, pageId };
}

function Gap({ pageId }: { pageId: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: `before:${pageId}` });

  return (
    <li
      ref={setNodeRef}
      aria-hidden="true"
      className={cn('h-1.5 rounded', isOver ? 'bg-accent' : 'bg-transparent')}
    />
  );
}

interface RowProps extends PageRow {
  active: boolean;
  canEdit: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onPick: () => void;
  onCreate: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}

function Row({
  page,
  depth,
  hasChildren,
  active,
  canEdit,
  collapsed,
  onToggle,
  onPick,
  onCreate,
  onRename,
  onDelete,
}: RowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(page.title);
  const drop = useDroppable({ id: `inside:${page.id}` });
  const drag = useDraggable({ id: page.id, disabled: !canEdit || editing });
  const Chevron = collapsed ? ChevronRight : ChevronDown;

  const commit = (): void => {
    const title = draft.trim();

    setEditing(false);

    if (title !== '' && title !== page.title) {
      onRename(title);
    } else {
      setDraft(page.title);
    }
  };

  return (
    <li
      ref={drop.setNodeRef}
      className={cn(
        'flex items-center gap-1 rounded-lg',
        drop.isOver ? 'ring-1 ring-accent' : null,
        drag.isDragging ? 'opacity-40' : null,
      )}
      style={{ paddingLeft: `${String(depth * 12)}px` }}
    >
      {hasChildren ? (
        <button
          type="button"
          aria-label={collapsed ? `Abrir ${page.title}` : `Recolher ${page.title}`}
          aria-expanded={!collapsed}
          className="flex h-11 w-6 shrink-0 items-center justify-center text-muted hover:text-ink md:h-8"
          onClick={onToggle}
        >
          <Chevron className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : (
        <span className="h-11 w-6 shrink-0 md:h-8" aria-hidden="true" />
      )}

      {editing ? (
        <Input
          autoFocus
          aria-label={`Renomear ${page.title}`}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              commit();
            }

            if (event.key === 'Escape') {
              setDraft(page.title);
              setEditing(false);
            }
          }}
          className="h-9 flex-1"
        />
      ) : (
        <button
          type="button"
          ref={drag.setNodeRef}
          {...drag.attributes}
          {...drag.listeners}
          aria-current={active ? 'page' : undefined}
          onClick={onPick}
          onDoubleClick={() => {
            if (canEdit) {
              setEditing(true);
            }
          }}
          className={cn(
            'flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-left text-[13px] md:min-h-9',
            active ? 'bg-accent/15 font-semibold text-ink' : 'text-body hover:bg-surface-2',
          )}
        >
          <FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{page.title}</span>
        </button>
      )}

      {canEdit && !editing ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Ações de ${page.title}`}>
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onCreate}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Subpágina
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setEditing(true);
              }}
            >
              Renomear
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onDelete}>
              <Trash2 className="h-4 w-4" aria-hidden="true" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </li>
  );
}

/**
 * Árvore de páginas do Doc: aninhar, arrastar (soltar na linha aninha, soltar no
 * vão reordena), renomear no lugar e criar subpágina.
 */
export function PageTreePanel({
  pages,
  activeId,
  canEdit,
  onPick,
  onCreate,
  onRename,
  onDelete,
  onMove,
}: PageTreePanelProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState<string | null>(null);
  const rows = flattenTree(buildPageTree(pages), collapsed);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (event: DragEndEvent): void => {
    setDragging(null);

    if (!event.over) {
      return;
    }

    const target = parseTarget(String(event.over.id));

    if (target) {
      onMove(String(event.active.id), target.pageId, target.position);
    }
  };

  return (
    <div className="flex min-h-0 flex-col gap-3">
      {canEdit ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            onCreate(null);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Nova página
        </Button>
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={(event: DragStartEvent) => {
          setDragging(String(event.active.id));
        }}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setDragging(null);
        }}
      >
        <ul aria-label="Páginas do Doc" className="flex min-h-0 flex-col gap-0.5 overflow-y-auto">
          {rows.map((row) => (
            <Fragment key={row.page.id}>
              <Gap pageId={row.page.id} />
              <Row
                {...row}
                active={row.page.id === activeId}
                canEdit={canEdit}
                collapsed={collapsed.has(row.page.id)}
                onToggle={() => {
                  setCollapsed((current) => {
                    const next = new Set(current);

                    if (next.has(row.page.id)) {
                      next.delete(row.page.id);
                    } else {
                      next.add(row.page.id);
                    }

                    return next;
                  });
                }}
                onPick={() => {
                  onPick(row.page.id);
                }}
                onCreate={() => {
                  onCreate(row.page.id);
                }}
                onRename={(title) => {
                  onRename(row.page.id, title);
                }}
                onDelete={() => {
                  onDelete(row.page.id);
                }}
              />
            </Fragment>
          ))}
        </ul>

        <DragOverlay dropAnimation={null}>
          {dragging ? (
            <span className="rounded-lg border border-accent bg-surface px-2 py-1 text-[13px] text-ink shadow-xl">
              {pages.find((page) => page.id === dragging)?.title ?? ''}
            </span>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
