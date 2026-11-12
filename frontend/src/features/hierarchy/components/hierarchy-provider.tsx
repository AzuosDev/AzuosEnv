import { useNavigate, useRouterState } from '@tanstack/react-router';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { ConfirmDialog } from '@/features/settings/components/confirm-dialog';
import { SaveTemplateDialog } from '@/features/templates/components/save-template-dialog';
import { SprintFolderDialog } from '@/features/sprints/components/sprint-folder-dialog';
import { useArchiveNode, useDeleteNode } from '../hooks/use-hierarchy-actions';
import { NODE_LABEL } from '../node-kinds';
import type { FlatNode } from '../tree-dnd';
import { FolderDialog } from './folder-dialog';
import { ListDialog } from './list-dialog';
import { MoveDialog } from './move-dialog';
import { ShareDialog } from './share-dialog';
import { SpaceDialog } from './space-dialog';
import { StatusesDialog } from './statuses-dialog';

export type HierarchyDialog =
  | { type: 'createSpace' }
  | { type: 'createFolder'; parent: { spaceId: string; parentFolderId: string | null } }
  | { type: 'createList'; parent: { spaceId: string; folderId: string | null } }
  | { type: 'edit'; node: FlatNode; focus?: 'name' | 'appearance' }
  | { type: 'move'; node: FlatNode }
  | { type: 'share'; node: FlatNode }
  | { type: 'statuses'; node: FlatNode }
  | { type: 'archive'; node: FlatNode }
  | { type: 'template'; node: FlatNode }
  | { type: 'sprints'; node: FlatNode }
  | { type: 'delete'; node: FlatNode };

export interface HierarchyActions {
  open: (dialog: HierarchyDialog) => void;
  /** Workspace do provider; os menus da árvore precisam dele. */
  wsId: string;
}

const HierarchyContext = createContext<HierarchyActions | null>(null);

/** Ações da hierarquia disponíveis para a sidebar e para as páginas do local. */
export function useHierarchy(): HierarchyActions {
  const context = useContext(HierarchyContext);

  if (!context) {
    throw new Error('useHierarchy precisa do HierarchyProvider.');
  }

  return context;
}

/**
 * Dono dos diálogos da hierarquia: a sidebar e as páginas só pedem para abrir,
 * então existe um diálogo montado por vez, não um por linha da árvore.
 */
export function HierarchyProvider({ wsId, children }: { wsId: string; children: ReactNode }) {
  const [dialog, setDialog] = useState<HierarchyDialog | null>(null);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const archive = useArchiveNode(wsId);
  const remove = useDeleteNode(wsId);

  const close = useCallback(() => {
    setDialog(null);
  }, []);

  const actions = useMemo<HierarchyActions>(() => ({ open: setDialog, wsId }), [wsId]);

  /** Sai da rota do item quando ele deixa a árvore. */
  const leaveIfOpen = (node: FlatNode): void => {
    if (pathname.includes(`/${node.id}`)) {
      void navigate({ to: '/w/$wsId', params: { wsId }, replace: true });
    }
  };

  return (
    <HierarchyContext.Provider value={actions}>
      {children}

      {dialog?.type === 'createSpace' ? <SpaceDialog wsId={wsId} onClose={close} /> : null}

      {dialog?.type === 'createFolder' ? (
        <FolderDialog wsId={wsId} parent={dialog.parent} onClose={close} />
      ) : null}

      {dialog?.type === 'createList' ? (
        <ListDialog wsId={wsId} parent={dialog.parent} onClose={close} />
      ) : null}

      {dialog?.type === 'edit' && dialog.node.kind === 'space' ? (
        <SpaceDialog
          wsId={wsId}
          spaceId={dialog.node.id}
          focus={dialog.focus ?? 'name'}
          onClose={close}
        />
      ) : null}

      {dialog?.type === 'edit' && dialog.node.kind === 'folder' ? (
        <FolderDialog wsId={wsId} folderId={dialog.node.id} onClose={close} />
      ) : null}

      {dialog?.type === 'edit' && dialog.node.kind === 'list' ? (
        <ListDialog wsId={wsId} listId={dialog.node.id} onClose={close} />
      ) : null}

      {dialog?.type === 'move' ? (
        <MoveDialog wsId={wsId} node={dialog.node} onClose={close} />
      ) : null}

      {dialog?.type === 'share' ? (
        <ShareDialog wsId={wsId} node={dialog.node} onClose={close} />
      ) : null}

      {dialog?.type === 'statuses' ? (
        <StatusesDialog wsId={wsId} node={dialog.node} onClose={close} />
      ) : null}

      {dialog?.type === 'template' ? (
        <SaveTemplateDialog
          wsId={wsId}
          open
          onOpenChange={close}
          source={{ type: dialog.node.kind, id: dialog.node.id, name: dialog.node.name }}
        />
      ) : null}

      {dialog?.type === 'sprints' ? (
        <SprintFolderDialog
          wsId={wsId}
          spaceId={dialog.node.spaceId}
          spaceName={dialog.node.name}
          onClose={close}
        />
      ) : null}

      {dialog?.type === 'archive' ? (
        <ConfirmDialog
          open
          onOpenChange={close}
          title={`Arquivar ${NODE_LABEL[dialog.node.kind]}`}
          description={`“${dialog.node.name}” sai da árvore e fica em Arquivados. Nada é perdido.`}
          confirmLabel="Arquivar"
          pending={archive.isPending}
          onConfirm={() => {
            const node = dialog.node;

            archive.mutate(
              { kind: node.kind, id: node.id, name: node.name },
              {
                onSuccess: () => {
                  leaveIfOpen(node);
                  close();
                },
              },
            );
          }}
        />
      ) : null}

      {dialog?.type === 'delete' ? (
        <ConfirmDialog
          open
          onOpenChange={close}
          danger
          title={`Excluir ${NODE_LABEL[dialog.node.kind]}`}
          description={`“${dialog.node.name}” vai para a lixeira com tudo que está dentro e fica lá por 30 dias.`}
          confirmLabel="Excluir"
          pending={remove.isPending}
          onConfirm={() => {
            const node = dialog.node;

            remove.mutate(
              { kind: node.kind, id: node.id, name: node.name },
              {
                onSuccess: () => {
                  leaveIfOpen(node);
                  close();
                },
              },
            );
          }}
        />
      ) : null}
    </HierarchyContext.Provider>
  );
}
