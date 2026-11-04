import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { AuthLayout } from '@/features/auth/components/auth-layout';
import { Field, FormAlert } from '@/features/auth/components/field';
import { createWorkspace } from '@/features/workspaces/api';
import {
  DEFAULT_WORKSPACE_COLOR,
  suggestTaskPrefix,
  WORKSPACE_COLORS,
} from '@/features/workspaces/prefix';
import { colorField, taskPrefixField } from '@/lib/validation';

const schema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do workspace.').max(80, 'Nome muito longo.'),
  taskPrefix: taskPrefixField,
  color: colorField,
});

type Values = z.infer<typeof schema>;

function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register: field,
    handleSubmit,
    setValue,
    getFieldState,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', taskPrefix: '', color: DEFAULT_WORKSPACE_COLOR },
  });

  const nameField = field('name');

  const submit = handleSubmit(async (values) => {
    setFormError(null);

    try {
      const workspace = await createWorkspace(values);

      // Removido, e não invalidado: o loader da próxima rota precisa da lista
      // nova, não da lista vazia que está em cache.
      queryClient.removeQueries({ queryKey: queryKeys.workspaces() });
      await navigate({ to: '/w/$wsId', params: { wsId: workspace.id }, replace: true });
    } catch (error) {
      setFormError(errorMessage(error));
    }
  });

  return (
    <AuthLayout
      title="Criar workspace"
      description="O workspace guarda espaços, listas e tarefas da equipe."
    >
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        {formError ? <FormAlert>{formError}</FormAlert> : null}

        <Field id="name" label="Nome do workspace" error={errors.name?.message}>
          <Input
            id="name"
            autoFocus
            placeholder="Azuos Dev"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'name-error' : undefined}
            {...nameField}
            onChange={(event) => {
              void nameField.onChange(event);

              if (!getFieldState('taskPrefix').isDirty) {
                setValue('taskPrefix', suggestTaskPrefix(event.target.value));
              }
            }}
          />
        </Field>

        <Field
          id="taskPrefix"
          label="Prefixo das tarefas"
          hint="De 2 a 6 letras ou números; aparece no código da tarefa (ex.: AZD-120)."
          error={errors.taskPrefix?.message}
        >
          <Input
            id="taskPrefix"
            placeholder="AZD"
            maxLength={6}
            className="uppercase"
            aria-invalid={Boolean(errors.taskPrefix)}
            aria-describedby={errors.taskPrefix ? 'taskPrefix-error' : 'taskPrefix-hint'}
            {...field('taskPrefix')}
          />
        </Field>

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

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Spinner label="Criando workspace" /> : 'Criar workspace'}
        </Button>
      </form>
    </AuthLayout>
  );
}

export const Route = createFileRoute('/_app/onboarding')({ component: OnboardingPage });
