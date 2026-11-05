import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { CreateTaskInput, TaskPriority } from '@/api/types';
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
import { Label } from '@/components/ui/label';
import { SelectNative } from '@/components/ui/select-native';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { Field, FormAlert } from '@/features/auth/components/field';
import { membersQuery } from '@/features/settings/api';
import { createTask, listStatusesQuery } from '../api';
import { PRIORITY_OPTIONS } from '../task-fields';
import { ListPicker } from './list-picker';

const schema = z.object({
  name: z.string().trim().min(1, 'Dê um nome à tarefa.').max(500, 'Nome muito longo.'),
  listId: z.string().min(1, 'Escolha a List.'),
  statusId: z.string(),
  assigneeId: z.string(),
  dueDay: z.string(),
  priority: z.string(),
});

type Values = z.infer<typeof schema>;

/** Criação rápida da topbar: nome, List, status, responsável, prazo e prioridade. */
function NewTaskForm({ wsId, onClose }: { wsId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', listId: '', statusId: '', assigneeId: '', dueDay: '', priority: '' },
  });
  const listId = form.watch('listId');
  const statuses = useQuery({
    ...listStatusesQuery(wsId, listId),
    enabled: listId !== '',
  });
  const members = useQuery(membersQuery(wsId));

  const save = useMutation({
    mutationFn: async (data: Values) => {
      const body: CreateTaskInput = {
        name: data.name,
        ...(data.statusId ? { statusId: data.statusId } : {}),
        ...(data.assigneeId ? { assigneeIds: [data.assigneeId] } : {}),
        ...(data.priority ? { priority: data.priority as TaskPriority } : {}),
        ...(data.dueDay ? { dueAt: new Date(`${data.dueDay}T12:00:00`).toISOString() } : {}),
      };

      return createTask(wsId, data.listId, body);
    },
    onSuccess: (task) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tree(wsId) });
      void queryClient.invalidateQueries({ queryKey: ['workspaces', wsId, 'tasks'] });
      toast.success(`${task.customId} criada.`);
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

      <Field id="task-name" label="Nome" error={form.formState.errors.name?.message}>
        <Input
          id="task-name"
          autoFocus
          autoComplete="off"
          {...form.register('name')}
          aria-invalid={Boolean(form.formState.errors.name)}
        />
      </Field>

      <Field id="task-list" label="List" error={form.formState.errors.listId?.message}>
        <ListPicker
          id="task-list"
          wsId={wsId}
          value={listId}
          onChange={(next) => {
            form.setValue('listId', next, { shouldDirty: true, shouldValidate: true });
            form.setValue('statusId', '');
          }}
        />
      </Field>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="task-status">Status</Label>
        <SelectNative id="task-status" disabled={listId === ''} {...form.register('statusId')}>
          <option value="">Primeiro status da List</option>
          {(statuses.data?.statuses ?? []).map((status) => (
            <option key={status.id} value={status.id}>
              {status.name}
            </option>
          ))}
        </SelectNative>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="task-assignee">Responsável</Label>
        <SelectNative id="task-assignee" {...form.register('assigneeId')}>
          <option value="">Sem responsável</option>
          {(members.data ?? []).map((member) => (
            <option key={member.id} value={member.userId.id}>
              {member.userId.name}
            </option>
          ))}
        </SelectNative>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="task-due">Prazo</Label>
        <Input id="task-due" type="date" {...form.register('dueDay')} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="task-priority">Prioridade</Label>
        <SelectNative id="task-priority" {...form.register('priority')}>
          <option value="">Sem prioridade</option>
          {PRIORITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectNative>
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? <Spinner label="Criando" /> : 'Criar tarefa'}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Botão "Nova tarefa" da topbar com o diálogo de criação rápida. */
export function NewTaskButton({ wsId }: { wsId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        size="sm"
        className="shrink-0"
        onClick={() => {
          setOpen(true);
        }}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        <span className="hidden md:inline">Nova tarefa</span>
        <span className="sr-only md:hidden">Nova tarefa</span>
      </Button>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova tarefa</DialogTitle>
          <DialogDescription>Ela nasce na List escolhida.</DialogDescription>
        </DialogHeader>
        {open ? (
          <NewTaskForm
            wsId={wsId}
            onClose={() => {
              setOpen(false);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
