import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { errorMessage } from '@/api/errors';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { Field, FormAlert } from '@/features/auth/components/field';
import { PasswordField } from '@/features/auth/components/password-field';
import { useLogout } from '@/features/auth/hooks/use-logout';
import { currentPasswordField, newPasswordField } from '@/lib/validation';
import { changePassword } from '../api';
import { SettingsCard } from './settings-card';

const schema = z
  .object({
    currentPassword: currentPasswordField,
    newPassword: newPasswordField,
    confirmPassword: z.string().min(1, 'Repita a nova senha.'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não são iguais.',
  });

type Values = z.infer<typeof schema>;

/** Troca de senha; o backend encerra todas as sessões, então saímos em seguida. */
export function PasswordForm() {
  const logout = useLogout();
  const {
    register: field,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const change = useMutation({
    mutationFn: (values: Values) =>
      changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }),
    onSuccess: () => {
      toast.success('Senha alterada. Entre de novo com a senha nova.');
      logout.mutate('current');
    },
  });

  const submit = handleSubmit((values) => change.mutateAsync(values).catch(() => undefined));
  const busy = change.isPending || logout.isPending;

  return (
    <SettingsCard
      title="Senha"
      description="Trocar a senha encerra as sessões de todos os dispositivos."
    >
      <form className="flex max-w-md flex-col gap-4" onSubmit={submit} noValidate>
        {change.isError ? <FormAlert>{errorMessage(change.error)}</FormAlert> : null}

        <Field id="currentPassword" label="Senha atual" error={errors.currentPassword?.message}>
          <PasswordField
            id="currentPassword"
            autoComplete="current-password"
            aria-invalid={Boolean(errors.currentPassword)}
            {...field('currentPassword')}
          />
        </Field>

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

        <Field
          id="confirmPassword"
          label="Repetir a nova senha"
          error={errors.confirmPassword?.message}
        >
          <PasswordField
            id="confirmPassword"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.confirmPassword)}
            {...field('confirmPassword')}
          />
        </Field>

        <div className="flex">
          <Button type="submit" disabled={busy}>
            {busy ? <Spinner label="Alterando senha" /> : 'Alterar senha'}
          </Button>
        </div>
      </form>
    </SettingsCard>
  );
}
