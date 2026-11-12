import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { FavoriteEntityType, FavoriteItem } from '@/api/types';
import { toast } from '@/components/ui/toast';
import { addFavorite, favoritesQuery, removeFavorite, reorderFavorite } from '../api';
import { favoriteOf, planFavoriteReorder, visibleFavorites } from '../favorite-model';

/** Favoritos do workspace com as escritas que a estrela e a sidebar usam. */
export function useFavorites(wsId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.favorites(wsId);
  const list = useQuery(favoritesQuery(wsId));
  const items = visibleFavorites(list.data);

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: key });
  }, [key, queryClient]);

  const fail = useCallback((error: unknown) => {
    toast.error(errorMessage(error));
  }, []);

  const add = useMutation({
    mutationFn: ({ entityType, entityId }: { entityType: FavoriteEntityType; entityId: string }) =>
      addFavorite(wsId, { entityType, entityId }),
    onSuccess: () => {
      refresh();
      toast.success('Adicionado aos favoritos.');
    },
    onError: fail,
  });

  const remove = useMutation({
    mutationFn: ({ favoriteId }: { favoriteId: string }) => removeFavorite(wsId, favoriteId),
    onMutate: ({ favoriteId }) => {
      const snapshot = queryClient.getQueryData<FavoriteItem[]>(key);

      queryClient.setQueryData<FavoriteItem[]>(key, (current) =>
        current?.filter((item) => item.id !== favoriteId),
      );

      return snapshot;
    },
    onError: (error, _variables, snapshot) => {
      if (snapshot) {
        queryClient.setQueryData(key, snapshot);
      }

      fail(error);
    },
    onSuccess: refresh,
  });

  const reorder = useMutation({
    mutationFn: ({ activeId, overId }: { activeId: string; overId: string }) => {
      const plan = planFavoriteReorder(items, activeId, overId);

      if (!plan) {
        return Promise.resolve(null);
      }

      return reorderFavorite(wsId, activeId, {
        ...(plan.previousId ? { previousId: plan.previousId } : {}),
        ...(plan.nextId ? { nextId: plan.nextId } : {}),
      });
    },
    onMutate: ({ activeId, overId }) => {
      const snapshot = queryClient.getQueryData<FavoriteItem[]>(key);
      const plan = planFavoriteReorder(items, activeId, overId);

      if (plan) {
        queryClient.setQueryData<FavoriteItem[]>(key, plan.items);
      }

      return snapshot;
    },
    onError: (error, _variables, snapshot) => {
      if (snapshot) {
        queryClient.setQueryData(key, snapshot);
      }

      fail(error);
    },
    onSuccess: refresh,
  });

  /** Liga ou desliga a estrela da entidade, do jeito que a UI espera. */
  const toggle = useCallback(
    (entityType: FavoriteEntityType, entityId: string): void => {
      const existing = favoriteOf(items, entityType, entityId);

      if (existing) {
        remove.mutate({ favoriteId: existing.id });

        return;
      }

      add.mutate({ entityType, entityId });
    },
    [add, items, remove],
  );

  return { list, items, add, remove, reorder, toggle };
}
