import { Star } from 'lucide-react';
import type { FavoriteEntityType } from '@/api/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { favoriteOf } from '../favorite-model';
import { useFavorites } from '../hooks/use-favorites';

export interface FavoriteStarProps {
  wsId: string;
  entityType: FavoriteEntityType;
  entityId: string;
  /** Nome da entidade; entra no rótulo do botão. */
  name: string;
  className?: string;
}

/** Estrela de favoritar: mesma ação em tarefa, Space, Folder, List e Doc. */
export function FavoriteStar({ wsId, entityType, entityId, name, className }: FavoriteStarProps) {
  const { items, toggle, add, remove } = useFavorites(wsId);
  const existing = favoriteOf(items, entityType, entityId);
  const marked = existing !== null;

  return (
    <Button
      variant="nav"
      size="icon"
      aria-pressed={marked}
      aria-label={marked ? `Tirar “${name}” dos favoritos` : `Favoritar “${name}”`}
      disabled={add.isPending || remove.isPending}
      className={cn('h-11 w-11 md:h-9 md:w-9', marked && 'text-accent', className)}
      onClick={() => {
        toggle(entityType, entityId);
      }}
    >
      <Star className={cn('h-4 w-4', marked && 'fill-current')} aria-hidden="true" />
    </Button>
  );
}
