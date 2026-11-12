import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { errorMessage } from '@/api/errors';
import type { CreateWhiteboardInput, Whiteboard, WhiteboardLocationType } from '@/api/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectNative } from '@/components/ui/select-native';
import { toast } from '@/components/ui/toast';
import { treeQuery } from '@/features/shell/api';
import { createWhiteboard } from '../api';

export interface NewWhiteboardDialogProps {
  wsId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (board: Whiteboard) => void;
}

interface LocationOption {
  value: string;
  label: string;
  locationType: WhiteboardLocationType;
  locationId?: string;
}

/** Quadro novo: título e o local que define quem vê. */
export function NewWhiteboardDialog({
  wsId,
  open,
  onOpenChange,
  onCreated,
}: NewWhiteboardDialogProps) {
  const client = useQueryClient();
  const tree = useQuery({ ...treeQuery(wsId), enabled: open });
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('workspace');

  const options: LocationOption[] = [
    { value: 'workspace', label: 'Workspace', locationType: 'workspace' },
  ];

  for (const space of tree.data?.spaces ?? []) {
    options.push({
      value: `space:${space.id}`,
      label: `Space: ${space.name}`,
      locationType: 'space',
      locationId: space.id,
    });

    for (const folder of space.folders) {
      options.push({
        value: `folder:${folder.id}`,
        label: `Folder: ${space.name} › ${folder.name}`,
        locationType: 'folder',
        locationId: folder.id,
      });

      for (const list of folder.lists) {
        options.push({
          value: `list:${list.id}`,
          label: `List: ${folder.name} › ${list.name}`,
          locationType: 'list',
          locationId: list.id,
        });
      }
    }

    for (const list of space.lists) {
      options.push({
        value: `list:${list.id}`,
        label: `List: ${space.name} › ${list.name}`,
        locationType: 'list',
        locationId: list.id,
      });
    }
  }

  const picked = options.find((option) => option.value === location) ?? options[0];

  const create = useMutation({
    mutationFn: (body: CreateWhiteboardInput) => createWhiteboard(wsId, body),
    onSuccess: async (board) => {
      setTitle('');
      onOpenChange(false);
      await client.invalidateQueries({ queryKey: ['workspaces', wsId, 'whiteboards'] });
      onCreated(board);
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo quadro</DialogTitle>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();

            const name = title.trim();

            if (name === '') {
              return;
            }

            create.mutate({
              title: name,
              locationType: picked?.locationType ?? 'workspace',
              ...(picked?.locationId === undefined ? {} : { locationId: picked.locationId }),
            });
          }}
        >
          <div>
            <Label htmlFor="board-new-title">Título</Label>
            <Input
              id="board-new-title"
              autoFocus
              value={title}
              placeholder="Brainstorm do PDV"
              onChange={(event) => {
                setTitle(event.target.value);
              }}
            />
          </div>

          <div>
            <Label htmlFor="board-new-location">Local</Label>
            <SelectNative
              id="board-new-location"
              value={location}
              onChange={(event) => {
                setLocation(event.target.value);
              }}
            >
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectNative>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onOpenChange(false);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={title.trim() === '' || create.isPending}>
              Criar quadro
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
