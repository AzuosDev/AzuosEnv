import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { UpdateViewInput, View, ViewLocationType, ViewType } from '@/api/types';
import { toast } from '@/components/ui/toast';
import { createView, deleteView, duplicateView, updateView } from '../api';

export interface ViewActionsOptions {
  wsId: string;
  locationType: ViewLocationType;
  locationId: string;
}

/** Criar, renomear, duplicar, marcar e excluir as views do local. */
export function useViewActions({ wsId, locationType, locationId }: ViewActionsOptions) {
  const queryClient = useQueryClient();
  const key = queryKeys.views(wsId, locationType, locationId);

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: key });
  }, [key, queryClient]);

  const fail = useCallback((error: unknown) => {
    toast.error(errorMessage(error));
  }, []);

  const create = useMutation({
    mutationFn: ({ type, name }: { type: ViewType; name: string }) =>
      createView(wsId, { locationType, locationId, type, name }),
    onSuccess: () => {
      refresh();
      toast.success('View criada.');
    },
    onError: fail,
  });

  const update = useMutation({
    mutationFn: ({ viewId, body }: { viewId: string; body: UpdateViewInput }) =>
      updateView(wsId, viewId, body),
    onMutate: ({ viewId, body }: { viewId: string; body: UpdateViewInput }) => {
      const snapshot = queryClient.getQueryData<View[]>(key);

      queryClient.setQueryData<View[]>(key, (views) =>
        views?.map((view) => (view.id === viewId ? { ...view, ...body } : view)),
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

  const duplicate = useMutation({
    mutationFn: ({ viewId }: { viewId: string }) => duplicateView(wsId, viewId),
    onSuccess: () => {
      refresh();
      toast.success('View duplicada.');
    },
    onError: fail,
  });

  const remove = useMutation({
    mutationFn: ({ viewId }: { viewId: string; name: string }) => deleteView(wsId, viewId),
    onSuccess: (_data, { name }) => {
      refresh();
      toast.success(`View "${name}" excluída.`);
    },
    onError: fail,
  });

  return { create, update, duplicate, remove };
}
