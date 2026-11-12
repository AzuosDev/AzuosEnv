import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { Lock, Mail } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { z } from 'zod';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { login } from '@/features/auth/api';
import { AccessLayout } from '@/features/auth/components/access-layout';
import { Field, FormAlert } from '@/features/auth/components/field';
import { IconInput } from '@/features/auth/components/icon-input';
import { PasswordField } from '@/features/auth/components/password-field';
import { safeNext } from '@/features/auth/navigation';
import { setSession } from '@/features/auth/session';
import { currentPasswordField, emailField } from '@/lib/validation';

const schema = z.object({ email: emailField, password: currentPasswordField });

type Values = z.infer<typeof schema>;

function LoginPage() {
  const { next, expirado } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const submit = handleSubmit(async (values) => {
    setFormError(null);

    try {
      const user = await login(values);

      setSession(queryClient, user);
      queryClient.removeQueries({ queryKey: queryKeys.workspaces() });
      await navigate({ to: safeNext(next), replace: true });
    } catch (error) {
      setFormError(errorMessage(error));
    }
  });

  return (
    <AccessLayout
      title="Entrar"
      description="Continue de onde a sua equipe parou."
      footer={
        <>
          Não tem conta?{' '}
          <Link to="/cadastro" className="font-semibold">
            Criar conta
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={submit} noValidate>
        {formError ? <FormAlert>{formError}</FormAlert> : null}
        {!formError && expirado ? (
          <FormAlert>Sua sessão expirou. Entre de novo para continuar.</FormAlert>
        ) : null}

        <Field id="email" label="E-mail" error={errors.email?.message}>
          <IconInput
            icon={Mail}
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="voce@azuos.dev"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'email-error' : undefined}
            {...field('email')}
          />
        </Field>

        <Field id="password" label="Senha" error={errors.password?.message}>
          <PasswordField
            icon={Lock}
            id="password"
            placeholder="Sua senha"
            autoComplete="current-password"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'password-error' : undefined}
            {...field('password')}
          />
        </Field>

        <Button type="submit" size="lg" className="w-full rounded-full" disabled={isSubmitting}>
          {isSubmitting ? <Spinner label="Entrando" /> : 'Entrar'}
        </Button>
      </form>
    </AccessLayout>
  );
}

export const Route = createFileRoute('/_public/login')({
  validateSearch: (search: Record<string, unknown>): { next?: string; expirado?: boolean } => ({
    next: typeof search.next === 'string' ? search.next : undefined,
    expirado: search.expirado === true || search.expirado === 'true' ? true : undefined,
  }),
  component: LoginPage,
});
