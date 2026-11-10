import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { errorMessage } from '@/api/errors';
import type { CreateDocInput, DocLocationType, WorkspaceDoc } from '@/api/types';
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
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { treeQuery } from '@/features/shell/api';
import { createDoc } from '../api';

export interface NewDocDialogProps {
  wsId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Local fixo quando o Doc nasce dentro de um Space, Folder ou List. */
  fixedLocation?: { locationType: DocLocationType; locationId?: string };
  onCreated: (doc: WorkspaceDoc) => void;
}

interface LocationOption {
  value: string;
  label: string;
  locationType: DocLocationType;
  locationId?: string;
}

/** Diálogo de Doc novo: título, local e a marca de wiki. */
export function NewDocDialog({
  wsId,
  open,
  onOpenChange,
  fixedLocation,
  onCreated,
}: NewDocDialogProps) {
  const client = useQueryClient();
  const tree = useQuery({ ...treeQuery(wsId), enabled: open && fixedLocation === undefined });
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('workspace');
  const [isWiki, setIsWiki] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);

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

  const create = useMutation({
    mutationFn: (body: CreateDocInput) => createDoc(wsId, body),
    onSuccess: async (doc) => {
      setTitle('');
      setIsWiki(false);
      setIsPrivate(false);
      onOpenChange(false);
      await client.invalidateQueries({ queryKey: ['workspaces', wsId, 'docs'] });
      onCreated(doc);
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });

  const picked = options.find((option) => option.value === location) ?? options[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Doc</DialogTitle>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();

            const name = title.trim();

            if (name === '') {
              return;
            }

            const place = fixedLocation ?? {
              locationType: picked?.locationType ?? 'workspace',
              ...(picked?.locationId !== undefined ? { locationId: picked.locationId } : {}),
            };

            create.mutate({
              title: name,
              ...place,
              isWiki,
              private: isPrivate,
            });
          }}
        >
          <div>
            <Label htmlFor="doc-title">Título</Label>
            <Input
              id="doc-title"
              autoFocus
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
              }}
              placeholder="Guia de deploy"
            />
          </div>

          {fixedLocation === undefined ? (
            <div>
              <Label htmlFor="doc-location">Local</Label>
              <SelectNative
                id="doc-location"
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
          ) : null}

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="doc-wiki" className="text-[13px]">
              Marcar como wiki do local
            </Label>
            <Switch
              id="doc-wiki"
              checked={isWiki}
              onCheckedChange={(checked) => {
                setIsWiki(checked);
              }}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="doc-private" className="text-[13px]">
              Privado (só você vê)
            </Label>
            <Switch
              id="doc-private"
              checked={isPrivate}
              onCheckedChange={(checked) => {
                setIsPrivate(checked);
              }}
            />
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
              Criar Doc
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
