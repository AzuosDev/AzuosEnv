import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Folder as FolderIcon,
  List as ListIcon,
  MoreHorizontal,
  Square,
  Star,
  type LucideIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { FavoriteEntityType, FavoriteItem, RecentItem } from '@/api/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { recentQuery } from '../api';
import { favoriteTarget, recentsToShow } from '../favorite-model';
import { useFavorites } from '../hooks/use-favorites';

const ICON: Record<FavoriteEntityType, LucideIcon> = {
  space: Square,
  folder: FolderIcon,
  list: ListIcon,
  task: Star,
  doc: ListIcon,
};

const sectionLabel = 'px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted';

const row =
  'flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 text-[13px] text-body no-underline hover:bg-surface-2 hover:text-ink';

/** Cabeçalho recolhível das duas seções. */
function SectionHeader({
  label,
  open,
  onToggle,
  action,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex min-h-9 items-center gap-1 rounded-lg hover:text-ink"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
        )}
        <span className={sectionLabel}>{label}</span>
      </button>
      {action}
    </div>
  );
}

function FavoriteRow({
  wsId,
  item,
  first,
  last,
  onNavigate,
  onMove,
  onRemove,
}: {
  wsId: string;
  item: FavoriteItem;
  first: boolean;
  last: boolean;
  onNavigate?: () => void;
  onMove: (direction: 'up' | 'down') => void;
  onRemove: () => void;
}) {
  const entity = item.entity;

  if (!entity) {
    return null;
  }

  const target = favoriteTarget(wsId, item.entityType, item.entityId, entity.customId);
  const Icon = ICON[item.entityType];
  const name = entity.customId ? `${entity.customId} ${entity.name}` : entity.name;

  return (
    <div className="group flex min-w-0 items-center">
      {target ? (
        <Link {...target} onClick={onNavigate} className={row}>
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{name}</span>
        </Link>
      ) : (
        <span className={cn(row, 'cursor-default text-muted')}>
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{name}</span>
        </span>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="nav"
            size="icon"
            aria-label={`Ações de ${entity.name}`}
            className="h-9 w-9 shrink-0 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100 md:has-[[data-state=open]]:opacity-100"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem
            disabled={first}
            onSelect={() => {
              onMove('up');
            }}
          >
            Mover para cima
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={last}
            onSelect={() => {
              onMove('down');
            }}
          >
            Mover para baixo
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onRemove}>Tirar dos favoritos</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function RecentRow({
  wsId,
  item,
  onNavigate,
}: {
  wsId: string;
  item: RecentItem;
  onNavigate?: () => void;
}) {
  const target = favoriteTarget(wsId, item.entityType, item.entityId, item.entity.customId);

  if (!target) {
    return null;
  }

  const name = item.entity.customId
    ? `${item.entity.customId} ${item.entity.name}`
    : item.entity.name;

  return (
    <Link {...target} onClick={onNavigate} className={row}>
      <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{name}</span>
    </Link>
  );
}

/** Favoritos (com reordenar) e Recentes, acima da árvore de Spaces. */
export function FavoritesSection({ wsId, onNavigate }: { wsId: string; onNavigate?: () => void }) {
  const { items, reorder, remove } = useFavorites(wsId);
  const recent = useQuery(recentQuery(wsId));
  const [openFavorites, setOpenFavorites] = useState(true);
  const [openRecent, setOpenRecent] = useState(false);
  const recents = recentsToShow(recent.data, items);

  return (
    <>
      {items.length > 0 ? (
        <nav aria-label="Favoritos" className="flex min-w-0 flex-col">
          <SectionHeader
            label="Favoritos"
            open={openFavorites}
            onToggle={() => {
              setOpenFavorites((value) => !value);
            }}
          />
          {openFavorites
            ? items.map((item, index) => (
                <FavoriteRow
                  key={item.id}
                  wsId={wsId}
                  item={item}
                  first={index === 0}
                  last={index === items.length - 1}
                  {...(onNavigate ? { onNavigate } : {})}
                  onMove={(direction) => {
                    const neighbour = items[direction === 'up' ? index - 1 : index + 1];

                    if (neighbour) {
                      reorder.mutate({ activeId: item.id, overId: neighbour.id });
                    }
                  }}
                  onRemove={() => {
                    remove.mutate({ favoriteId: item.id });
                  }}
                />
              ))
            : null}
        </nav>
      ) : null}

      {recents.length > 0 ? (
        <nav aria-label="Recentes" className="flex min-w-0 flex-col">
          <SectionHeader
            label="Recentes"
            open={openRecent}
            onToggle={() => {
              setOpenRecent((value) => !value);
            }}
          />
          {openRecent
            ? recents.map((item) => (
                <RecentRow
                  key={`${item.entityType}-${item.entityId}`}
                  wsId={wsId}
                  item={item}
                  {...(onNavigate ? { onNavigate } : {})}
                />
              ))
            : null}
        </nav>
      ) : null}
    </>
  );
}
