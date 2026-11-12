import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { View, ViewConfig, ViewLocationType } from '@/api/types';
import { toast } from '@/components/ui/toast';
import { updateView } from '../api';

/** Tempo que a toolbar espera antes de gravar a config na view. */
const DEBOUNCE_MS = 700;

export interface ViewConfigState {
  config: ViewConfig;
  /** Grava na view com debounce; a tela muda na hora. */
  update: (patch: (config: ViewConfig) => ViewConfig) => void;
  /** View protegida só aceita mudança do dono. */
  canEdit: boolean;
}

export interface UseViewConfigOptions {
  wsId: string;
  view: View | null;
  locationType: ViewLocationType;
  locationId: string;
  userId: string | undefined;
}

/**
 * Config da view aberta: estado local para a tela responder na hora e um PATCH
 * com debounce para guardar na view. View protegida é só leitura para quem não
 * é o dono.
 */
export function useViewConfig({
  wsId,
  view,
  locationType,
  locationId,
  userId,
}: UseViewConfigOptions): ViewConfigState {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<ViewConfig>(view?.config ?? {});
  const viewId = view?.id ?? null;
  const [openId, setOpenId] = useState(viewId);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canEdit = view ? !view.protected || view.ownerId === userId : false;

  // Trocar de aba recomeça o estado local a partir da config da view aberta.
  if (openId !== viewId) {
    setOpenId(viewId);
    setConfig(view?.config ?? {});
  }

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  const update = useCallback(
    (patch: (current: ViewConfig) => ViewConfig) => {
      if (!viewId || !canEdit) {
        return;
      }

      setConfig((current) => {
        const next = patch(current);

        if (timer.current) {
          clearTimeout(timer.current);
        }

        timer.current = setTimeout(() => {
          void updateView(wsId, viewId, { config: next })
            .then((saved) => {
              queryClient.setQueryData<View[]>(
                queryKeys.views(wsId, locationType, locationId),
                (views) => views?.map((item) => (item.id === saved.id ? saved : item)),
              );
            })
            .catch((error: unknown) => {
              toast.error(errorMessage(error, 'Não foi possível salvar a view.'));
            });
        }, DEBOUNCE_MS);

        return next;
      });
    },
    [canEdit, locationId, locationType, queryClient, viewId, wsId],
  );

  return { config, update, canEdit };
}
