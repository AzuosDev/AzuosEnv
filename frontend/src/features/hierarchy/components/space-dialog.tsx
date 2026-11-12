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
import { createSpace, spaceQuery, updateSpace } from '../api';
import { useTreeRefresh } from '../hooks/use-hierarchy-actions';
import { STATUS_TEMPLATES } from '../node-kinds';
import { ColorPicker, IconPicker } from './pickers';

const schema = z.object({
  name: z.string().trim().min(1, 'Dê um nome ao Space.').max(80, 'Nome muito longo.'),
  color: z.string(),
  icon: z.string(),
  private: z.boolean(),
  statusTemplate: z.enum(['dev', 'comercial', 'simples']),
});

type Values = z.infer<typeof schema>;

export interface SpaceDialogProps {
  wsId: string;
  /** Ausente cria um Space novo. */
  spaceId?: string;
  /** Abre com o foco no nome ou na aparência. */
  focus?: 'name' | 'appearance';
  onClose: () => void;
}

const DEFAULTS: Values = {
  name: '',
  color: '#2563EB',
  icon: '',
  private: false,
  statusTemplate: 'dev',
};

function SpaceForm({
  wsId,
  spaceId,
  focus,
  initial,
  onClose,
}: {
  wsId: string;
  spaceId?: string;
  focus: 'name' | 'appearance';
  initial: Values;
  onClose: () => void;
}) {
  const editing = spaceId !== undefined;
  const refresh = useTreeRefresh(wsId);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: initial });
  const values = form.watch();

  const save = useMutation({
    mutationFn: async (data: Values) => {
      if (editing && spaceId) {
        await updateSpace(wsId, spaceId, {
          name: data.name,
          color: data.color,
          icon: data.icon,
          ...(data.private === initial.private ? {} : { private: data.private }),
        });
      } else {
        await createSpace(wsId, {
          name: data.name,
          color: data.color,
          ...(data.icon ? { icon: data.icon } : {}),
          private: data.private,
          statusTemplate: data.statusTemplate,
        });
      }

      return data.name;
    },
    onSuccess: (name) => {
      refresh();
      toast.success(editing ? `Space "${name}" atualizado.` : `Space "${name}" criado.`);
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

      <Field id="space-name" label="Nome" error={form.formState.errors.name?.message}>
        <Input
          id="space-name"
          autoFocus={focus === 'name'}
          autoComplete="off"
          {...form.register('name')}
          aria-invalid={Boolean(form.formState.errors.name)}
        />
      </Field>

      <ColorPicker
        value={values.color}
        onChange={(color) => {
          form.setValue('color', color, { shouldDirty: true });
        }}
      />

      <IconPicker
        value={values.icon}
        onChange={(icon) => {
          form.setValue('icon', icon, { shouldDirty: true });
        }}
      />

      <div className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
        <span className="min-w-0">
          <span className="block text-[13.5px] font-medium text-ink" id="space-private-label">
            Space privado
          </span>
          <span className="mt-0.5 block text-[12.5px] text-muted">
            Só você e quem for convidado veem este Space.
          </span>
        </span>
        <Switch
          aria-labelledby="space-private-label"
          checked={values.private}
          onCheckedChange={(checked) => {
            form.setValue('private', checked, { shouldDirty: true });
          }}
        />
      </div>

      {editing ? null : (
        <fieldset className="flex flex-col gap-2">
          <legend className="pb-1.5 text-[13px] font-medium text-body">Template de statuses</legend>
          {STATUS_TEMPLATES.map((template) => (
            <label
              key={template.value}
              className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-line p-3 has-[:checked]:border-accent"
            >
              <input
                type="radio"
                value={template.value}
                className="mt-1 h-4 w-4 accent-accent"
                {...form.register('statusTemplate')}
              />
              <span className="min-w-0">
                <span className="block text-[13.5px] font-medium text-ink">{template.label}</span>
                <span className="mt-0.5 block text-[12.5px] text-muted">
                  {template.description}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? <Spinner label="Salvando" /> : editing ? 'Salvar' : 'Criar Space'}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Criar ou editar um Space: nome, cor, ícone, privacidade e template de statuses. */
export function SpaceDialog({ wsId, spaceId, focus = 'name', onClose }: SpaceDialogProps) {
  const editing = spaceId !== undefined;
  const current = useQuery({ ...spaceQuery(wsId, spaceId ?? ''), enabled: editing });
  const ready = !editing || current.data !== undefined;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="md:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar Space' : 'Novo Space'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'O Space guarda Folders e Lists com os mesmos statuses.'
              : 'Escolha o template de statuses que as tarefas deste Space vão usar.'}
          </DialogDescription>
        </DialogHeader>

        {current.isError ? <FormAlert>{errorMessage(current.error)}</FormAlert> : null}

        {ready ? (
          <SpaceForm
            wsId={wsId}
            {...(spaceId ? { spaceId } : {})}
            focus={focus}
            initial={
              current.data
                ? {
                    name: current.data.name,
                    color: current.data.color,
                    icon: current.data.icon ?? '',
                    private: current.data.private,
                    statusTemplate: 'dev',
                  }
                : DEFAULTS
            }
            onClose={onClose}
          />
        ) : (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-11" />
            <Skeleton className="h-11 w-2/3" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
