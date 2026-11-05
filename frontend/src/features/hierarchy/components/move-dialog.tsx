import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { TreeFolder, WorkspaceTree } from '@/api/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SelectNative } from '@/components/ui/select-native';
import { Spinner } from '@/components/ui/spinner';
import { Field } from '@/features/auth/components/field';
import { treeQuery } from '@/features/shell/api';
import { useMoveNode } from '../hooks/use-hierarchy-actions';
import { NODE_LABEL } from '../node-kinds';
import type { FlatNode } from '../tree-dnd';

interface Option {
  value: string;
  label: string;
  spaceId: string;
  folderId: string | null;
}

const ROOT = 'raiz';

function keyOf(spaceId: string, folderId: string | null): string {
  return `${spaceId}:${folderId ?? ROOT}`;
}

/** Destinos possíveis: a raiz de cada Space e os Folders que podem receber o nó. */
function destinations(tree: WorkspaceTree, node: FlatNode): Option[] {
  const options: Option[] = [];

  const walk = (folders: TreeFolder[], spaceId: string, prefix: string, depth: number): void => {
    for (const folder of folders) {
      const blocked = node.kind === 'folder' && (folder.id === node.id || depth > 0);

      if (!blocked) {
        options.push({
          value: keyOf(spaceId, folder.id),
          label: `${prefix} / ${folder.name}`,
          spaceId,
          folderId: folder.id,
        });
      }

      if (folder.id !== node.id) {
        walk(folder.folders, spaceId, `${prefix} / ${folder.name}`, depth + 1);
      }
    }
  };

  for (const space of tree.spaces) {
    options.push({
      value: keyOf(space.id, null),
      label: `${space.name} (raiz do Space)`,
      spaceId: space.id,
      folderId: null,
    });
    walk(space.folders, space.id, space.name, 0);
  }

  return options;
}

export interface MoveDialogProps {
  wsId: string;
  node: FlatNode;
  onClose: () => void;
}

/** Move um Folder ou uma List para outro Space ou Folder. */
export function MoveDialog({ wsId, node, onClose }: MoveDialogProps) {
  const tree = useQuery(treeQuery(wsId));
  const move = useMoveNode(wsId);
  const options = tree.data ? destinations(tree.data, node) : [];
  const [target, setTarget] = useState(keyOf(node.spaceId, node.folderId));
  const chosen = options.find((option) => option.value === target);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mover {NODE_LABEL[node.kind]}</DialogTitle>
          <DialogDescription>
            Escolha onde “{node.name}” vai ficar. O item entra no fim da nova casa.
          </DialogDescription>
        </DialogHeader>

        <Field id="move-target" label="Destino">
          <SelectNative
            id="move-target"
            value={target}
            onChange={(event) => {
              setTarget(event.target.value);
            }}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectNative>
        </Field>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={move.isPending || !chosen || target === keyOf(node.spaceId, node.folderId)}
            onClick={() => {
              if (!chosen) {
                return;
              }

              move.mutate(
                {
                  kind: node.kind,
                  id: node.id,
                  name: node.name,
                  target: { spaceId: chosen.spaceId, folderId: chosen.folderId },
                },
                { onSuccess: onClose },
              );
            }}
          >
            {move.isPending ? <Spinner label="Movendo" /> : 'Mover'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
