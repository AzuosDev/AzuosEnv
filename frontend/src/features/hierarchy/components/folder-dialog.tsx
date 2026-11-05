import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { errorMessage } from '@/api/errors';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { Field, FormAlert } from '@/features/auth/components/field';
import { createFolder, folderQuery, updateFolder } from '../api';
import { useTreeRefresh } from '../hooks/use-hierarchy-actions';

const schema = z.object({
  name: z.string().trim().min(1, 'Dê um nome ao Folder.').max(80, 'Nome muito longo.'),
  private: z.boolean(),
});

type Values = z.infer<typeof schema>;

export interface FolderDialogProps {
  wsId: string;
  /** Ausente cria um Folder novo. */
  folderId?: string;
  /** Casa do Folder novo. */
  parent?: { spaceId: string; parentFolderId: string | null };
  onClose: () => void;
}

function FolderForm({
  wsId,
  folderId,
  parent,
  initial,
  onClose,
}: {
  wsId: string;
  folderId?: string;
  parent?: { spaceId: string; parentFolderId: string | null };
  initial: Values;
  onClose: () => void;
}) {
  const editing = folderId !== undefined;
  const refresh = useTreeRefresh(wsId);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: initial });
  const isPrivate = form.watch('private');

  const save = useMutation({
    mutationFn: async (data: Values) => {
      if (editing && folderId) {
        await updateFolder(wsId, folderId, {
          name: data.name,
          ...(data.private === initial.private ? {} : { private: data.private }),
        });
      } else if (parent) {
        await createFolder(wsId, {
          spaceId: parent.spaceId,
          parentFolderId: parent.parentFolderId,
          name: data.name,
          private: data.private,
        });
      }

      return data.name;
    },
    onSuccess: (name) => {
      refresh();
      toast.success(editing ? `Folder "${name}" atualizado.` : `Folder "${name}" criado.`);
      onClose();
    },
  });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit((data) => {
          save.mutate(data);
        })(event);
      }}
    >
      {save.isError ? <FormAlert>{errorMessage(save.error)}</FormAlert> : null}

      <Field id="folder-name" label="Nome" error={form.formState.errors.name?.message}>
        <Input
          id="folder-name"
          autoFocus
          autoComplete="off"
          {...form.register('name')}
          aria-invalid={Boolean(form.formState.errors.name)}
        />
      </Field>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
        <span className="min-w-0">
          <span className="block text-[13.5px] font-medium text-ink" id="folder-private-label">
            Folder privado
          </span>
          <span className="mt-0.5 block text-[12.5px] text-muted">
            Só você e quem for convidado veem este Folder.
          </span>
        </span>
        <Switch
          aria-labelledby="folder-private-label"
          checked={isPrivate}
          onCheckedChange={(checked) => {
            form.setValue('private', checked, { shouldDirty: true });
          }}
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? <Spinner label="Salvando" /> : editing ? 'Salvar' : 'Criar Folder'}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Criar ou editar um Folder. */
export function FolderDialog({ wsId, folderId, parent, onClose }: FolderDialogProps) {
  const editing = folderId !== undefined;
  const current = useQuery({ ...folderQuery(wsId, folderId ?? ''), enabled: editing });
  const ready = !editing || current.data !== undefined;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar Folder' : 'Novo Folder'}</DialogTitle>
          <DialogDescription>
            O Folder agrupa Lists dentro do Space e pode ter um nível de subfolders.
          </DialogDescription>
        </DialogHeader>

        {current.isError ? <FormAlert>{errorMessage(current.error)}</FormAlert> : null}

        {ready ? (
          <FolderForm
            wsId={wsId}
            {...(folderId ? { folderId } : {})}
            {...(parent ? { parent } : {})}
            initial={{
              name: current.data?.name ?? '',
              private: current.data?.private ?? false,
            }}
            onClose={onClose}
          />
        ) : (
          <Skeleton className="h-11" />
        )}
      </DialogContent>
    </Dialog>
  );
}
