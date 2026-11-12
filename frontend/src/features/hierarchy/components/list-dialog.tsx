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
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { Field, FormAlert } from '@/features/auth/components/field';
import { createList, listQuery, updateList } from '../api';
import { useTreeRefresh } from '../hooks/use-hierarchy-actions';
import { ColorPicker } from './pickers';

const schema = z.object({
  name: z.string().trim().min(1, 'Dê um nome à List.').max(120, 'Nome muito longo.'),
  color: z.string(),
  description: z.string().trim().max(2000, 'Descrição muito longa.'),
});

type Values = z.infer<typeof schema>;

export interface ListDialogProps {
  wsId: string;
  /** Ausente cria uma List nova. */
  listId?: string;
  /** Casa da List nova: Space e, quando houver, Folder. */
  parent?: { spaceId: string; folderId: string | null };
  onClose: () => void;
}

function ListForm({
  wsId,
  listId,
  parent,
  initial,
  onClose,
}: {
  wsId: string;
  listId?: string;
  parent?: { spaceId: string; folderId: string | null };
  initial: Values;
  onClose: () => void;
}) {
  const editing = listId !== undefined;
  const refresh = useTreeRefresh(wsId);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: initial });
  const color = form.watch('color');

  const save = useMutation({
    mutationFn: async (data: Values) => {
      if (editing && listId) {
        await updateList(wsId, listId, {
          name: data.name,
          color: data.color,
          description: data.description,
        });
      } else if (parent) {
        await createList(wsId, {
          spaceId: parent.spaceId,
          folderId: parent.folderId,
          name: data.name,
          color: data.color,
          ...(data.description ? { description: data.description } : {}),
        });
      }

      return data.name;
    },
    onSuccess: (name) => {
      refresh();
      toast.success(editing ? `List "${name}" atualizada.` : `List "${name}" criada.`);
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

      <Field id="list-name" label="Nome" error={form.formState.errors.name?.message}>
        <Input
          id="list-name"
          autoFocus
          autoComplete="off"
          {...form.register('name')}
          aria-invalid={Boolean(form.formState.errors.name)}
        />
      </Field>

      <ColorPicker
        value={color}
        onChange={(next) => {
          form.setValue('color', next, { shouldDirty: true });
        }}
      />

      <Field
        id="list-description"
        label="Descrição"
        error={form.formState.errors.description?.message}
        hint="Opcional. Aparece na visão geral do Space."
      >
        <Textarea id="list-description" rows={3} {...form.register('description')} />
      </Field>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? <Spinner label="Salvando" /> : editing ? 'Salvar' : 'Criar List'}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Criar ou editar uma List. */
export function ListDialog({ wsId, listId, parent, onClose }: ListDialogProps) {
  const editing = listId !== undefined;
  const current = useQuery({ ...listQuery(wsId, listId ?? ''), enabled: editing });
  const ready = !editing || current.data !== undefined;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar List' : 'Nova List'}</DialogTitle>
          <DialogDescription>A List é onde as tarefas moram.</DialogDescription>
        </DialogHeader>

        {current.isError ? <FormAlert>{errorMessage(current.error)}</FormAlert> : null}

        {ready ? (
          <ListForm
            wsId={wsId}
            {...(listId ? { listId } : {})}
            {...(parent ? { parent } : {})}
            initial={{
              name: current.data?.name ?? '',
              color: current.data?.color ?? '#2563EB',
              description: current.data?.description ?? '',
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
