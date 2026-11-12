import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { Workspace } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { Field } from '@/features/auth/components/field';
import { WORKSPACE_COLORS } from '@/features/workspaces/prefix';
import { colorField, taskPrefixField } from '@/lib/validation';
import { updateWorkspace } from '../api';
import { SettingsCard } from './settings-card';

const schema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do workspace.').max(80, 'Nome muito longo.'),
  taskPrefix: taskPrefixField,
  color: colorField,
});

type Values = z.infer<typeof schema>;

/** Nome, cor e prefixo das tarefas; só admin e owner chegam aqui. */
export function WorkspaceForm({ wsId, workspace }: { wsId: string; workspace: Workspace }) {
  const queryClient = useQueryClient();
  const {
    register: field,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: workspace.name,
      taskPrefix: workspace.taskPrefix,
      color: workspace.color,
    },
  });

  const save = useMutation({
    mutationFn: (values: Values) => updateWorkspace(wsId, values),
    onSuccess: async (updated) => {
      reset({ name: updated.name, taskPrefix: updated.taskPrefix, color: updated.color });
      await queryClient.invalidateQueries({ queryKey: queryKeys.workspaces() });
      toast.success('Workspace salvo.');
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const submit = handleSubmit((values) => save.mutateAsync(values).catch(() => undefined));

  return (
    <SettingsCard
      title="Identidade do workspace"
      description="Vale para todas as pessoas do workspace."
    >
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        <div className="grid gap-4 md:grid-cols-2">
          <Field id="ws-name" label="Nome do workspace" error={errors.name?.message}>
            <Input id="ws-name" aria-invalid={Boolean(errors.name)} {...field('name')} />
          </Field>

          <Field
            id="ws-prefix"
            label="Prefixo das tarefas"
            hint="Aparece no código da tarefa (ex.: AZD-120)."
            error={errors.taskPrefix?.message}
          >
            <Input
              id="ws-prefix"
              maxLength={6}
              className="uppercase"
              aria-invalid={Boolean(errors.taskPrefix)}
              {...field('taskPrefix')}
            />
          </Field>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-[13px] font-medium text-body">Cor</legend>
          <div className="flex flex-wrap gap-2">
            {WORKSPACE_COLORS.map((color) => (
              <label
                key={color.value}
                className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-line hover:bg-surface-2 has-[:checked]:border-accent has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent"
              >
                <input
                  type="radio"
                  value={color.value}
                  aria-label={color.label}
                  className="absolute inset-0 m-0 h-full w-full cursor-pointer appearance-none rounded-xl"
                  {...field('color')}
                />
                <span
                  className={`pointer-events-none h-5 w-5 rounded-full ${color.swatch}`}
                  aria-hidden="true"
                />
              </label>
            ))}
          </div>
          {errors.color?.message ? (
            <p role="alert" className="text-[12px] text-danger">
              {errors.color.message}
            </p>
          ) : null}
        </fieldset>

        <div className="flex">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Spinner label="Salvando" /> : 'Salvar workspace'}
          </Button>
        </div>
      </form>
    </SettingsCard>
  );
}
