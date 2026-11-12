import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { queryKeys } from '@/api/keys';
import type { WorkspaceTree } from '@/api/types';
import { errorMessage } from '@/api/errors';
import { toast } from '@/components/ui/toast';
import type { TreeNodeKind } from '@/features/shell/tree-path';
import {
  archiveFolder,
  archiveList,
  archiveSpace,
  deleteFolder,
  deleteList,
  deleteSpace,
  moveFolder,
  moveList,
  reorderFolder,
  reorderList,
  reorderSpace,
  restoreFolder,
  restoreList,
  restoreSpace,
  unarchiveFolder,
  unarchiveList,
  unarchiveSpace,
} from '../api';
import { NODE_LABEL } from '../node-kinds';
import { applyDropPlan, type DropPlan, type DropTarget } from '../tree-dnd';

/** Invalida a árvore da sidebar; toda escrita da hierarquia passa por aqui. */
export function useTreeRefresh(wsId: string): () => void {
  const queryClient = useQueryClient();

  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.tree(wsId) });
  }, [queryClient, wsId]);
}

const ARCHIVE = { space: archiveSpace, folder: archiveFolder, list: archiveList };
const UNARCHIVE = { space: unarchiveSpace, folder: unarchiveFolder, list: unarchiveList };
const REMOVE = { space: deleteSpace, folder: deleteFolder, list: deleteList };
const RESTORE = { space: restoreSpace, folder: restoreFolder, list: restoreList };

export interface NodeAction {
  kind: TreeNodeKind;
  id: string;
  name: string;
}

export interface MoveAction extends NodeAction {
  target: DropTarget;
}

/** Arquivar e desarquivar; o toast traz o caminho de volta. */
export function useArchiveNode(wsId: string) {
  const refresh = useTreeRefresh(wsId);

  return useMutation({
    mutationFn: ({ kind, id }: NodeAction) => ARCHIVE[kind](wsId, id),
    onSuccess: (_data, { kind, id, name }) => {
      refresh();
      toast.success(`${NODE_LABEL[kind]} "${name}" arquivado.`, {
        action: {
          label: 'Desarquivar',
          onClick: () => {
            void UNARCHIVE[kind](wsId, id)
              .then(() => {
                refresh();
                toast.success(`"${name}" voltou para a árvore.`);
              })
              .catch((error: unknown) => {
                toast.error(errorMessage(error));
              });
          },
        },
      });
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });
}

export function useUnarchiveNode(wsId: string) {
  const queryClient = useQueryClient();
  const refresh = useTreeRefresh(wsId);

  return useMutation({
    mutationFn: ({ kind, id }: NodeAction) => UNARCHIVE[kind](wsId, id),
    onSuccess: (_data, { name }) => {
      refresh();
      void queryClient.invalidateQueries({ queryKey: queryKeys.archived(wsId) });
      toast.success(`"${name}" desarquivado.`);
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });
}

/** Exclui para a lixeira e oferece Desfazer, que chama o restore. */
export function useDeleteNode(wsId: string) {
  const refresh = useTreeRefresh(wsId);

  return useMutation({
    mutationFn: ({ kind, id }: NodeAction) => REMOVE[kind](wsId, id),
    onSuccess: (_data, { kind, id, name }) => {
      refresh();
      toast.success(`${NODE_LABEL[kind]} "${name}" foi para a lixeira.`, {
        action: {
          label: 'Desfazer',
          onClick: () => {
            void RESTORE[kind](wsId, id)
              .then(() => {
                refresh();
                toast.success(`"${name}" restaurado.`);
              })
              .catch((error: unknown) => {
                toast.error(errorMessage(error));
              });
          },
        },
      });
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });
}

/** Mover pelo diálogo: Folder troca de Space/Folder pai, List troca de Folder. */
export function useMoveNode(wsId: string) {
  const refresh = useTreeRefresh(wsId);

  return useMutation({
    mutationFn: async ({ kind, id, target }: MoveAction) => {
      if (kind === 'folder') {
        await moveFolder(wsId, id, { spaceId: target.spaceId, parentFolderId: target.folderId });

        return;
      }

      if (kind === 'list') {
        await moveList(wsId, id, { spaceId: target.spaceId, folderId: target.folderId });
      }
    },
    onSuccess: (_data, { name }) => {
      refresh();
      toast.success(`"${name}" movido.`);
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });
}

type Plan = DropPlan & { target: DropTarget; index: number };

/**
 * Drop da árvore: a tela já mostra o resultado (update otimista) e, se a API
 * recusar, a árvore do cache volta ao que era.
 */
export function useDropNode(wsId: string) {
  const queryClient = useQueryClient();
  const treeKey = queryKeys.tree(wsId);

  return useMutation({
    mutationFn: async (plan: Plan) => {
      if (plan.move && plan.kind === 'folder') {
        await moveFolder(wsId, plan.id, {
          spaceId: plan.move.spaceId,
          parentFolderId: plan.move.folderId,
        });
      }

      if (plan.move && plan.kind === 'list') {
        await moveList(wsId, plan.id, {
          spaceId: plan.move.spaceId,
          folderId: plan.move.folderId,
        });
      }

      if (!plan.previousId && !plan.nextId) {
        return;
      }

      const body = {
        ...(plan.previousId ? { previousId: plan.previousId } : {}),
        ...(plan.nextId ? { nextId: plan.nextId } : {}),
      };

      if (plan.kind === 'space') {
        await reorderSpace(wsId, plan.id, body);
      } else if (plan.kind === 'folder') {
        await reorderFolder(wsId, plan.id, body);
      } else {
        await reorderList(wsId, plan.id, body);
      }
    },
    onMutate: async (plan: Plan) => {
      await queryClient.cancelQueries({ queryKey: treeKey });

      const previous = queryClient.getQueryData<WorkspaceTree>(treeKey);

      if (previous) {
        queryClient.setQueryData<WorkspaceTree>(treeKey, applyDropPlan(previous, plan));
      }

      return { previous };
    },
    onError: (error: unknown, _plan, context) => {
      if (context?.previous) {
        queryClient.setQueryData<WorkspaceTree>(treeKey, context.previous);
      }

      toast.error(errorMessage(error));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: treeKey });
    },
  });
}
