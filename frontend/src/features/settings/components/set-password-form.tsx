import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { Field, FormAlert } from '@/features/auth/components/field';
import { PasswordField } from '@/features/auth/components/password-field';
import { newPasswordField } from '@/lib/validation';
import { setPassword } from '../api';
import { SettingsCard } from './settings-card';

const schema = z
  .object({
    newPassword: newPasswordField,
    confirmPassword: z.string().min(1, 'Repita a senha.'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não são iguais.',
  });

type Values = z.infer<typeof schema>;

/**
 * Primeira senha de quem entrou só com o Google. O backend mantém as sessões,
 * então ninguém é derrubado ao definir a senha.
 */
export function SetPasswordForm() {
  const queryClient = useQueryClient();
  const {
    register: field,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const define = useMutation({
    mutationFn: (values: Values) => setPassword({ password: values.newPassword }),
    onSuccess: async () => {
      reset();
      await queryClient.invalidateQueries({ queryKey: queryKeys.session() });
      toast.success('Senha definida. Agora você entra com e-mail e senha também.');
    },
  });

  const submit = handleSubmit((values) => define.mutateAsync(values).catch(() => undefined));

  return (
    <SettingsCard
      title="Senha"
      description="Você entrou com o Google e ainda não tem senha. Defina uma para entrar também com e-mail e senha."
    >
      <form className="flex max-w-md flex-col gap-4" onSubmit={submit} noValidate>
        {define.isError ? <FormAlert>{errorMessage(define.error)}</FormAlert> : null}

        <Field
          id="newPassword"
          label="Nova senha"
          hint="No mínimo 8 caracteres, com letra e número."
          error={errors.newPassword?.message}
        >
          <PasswordField
            id="newPassword"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.newPassword)}
            {...field('newPassword')}
          />
        </Field>

        <Field id="confirmPassword" label="Repetir a senha" error={errors.confirmPassword?.message}>
          <PasswordField
            id="confirmPassword"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.confirmPassword)}
            {...field('confirmPassword')}
          />
        </Field>

        <div className="flex">
          <Button type="submit" disabled={define.isPending}>
            {define.isPending ? <Spinner label="Definindo senha" /> : 'Definir senha'}
          </Button>
        </div>
      </form>
    </SettingsCard>
  );
}
