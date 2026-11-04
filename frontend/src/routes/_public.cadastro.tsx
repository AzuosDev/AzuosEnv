import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { login, register as registerAccount } from '@/features/auth/api';
import { AuthLayout } from '@/features/auth/components/auth-layout';
import { Field, FormAlert } from '@/features/auth/components/field';
import { PasswordField } from '@/features/auth/components/password-field';
import { setSession } from '@/features/auth/session';
import { emailField, nameField, newPasswordField, PASSWORD_MESSAGE } from '@/lib/validation';

const schema = z.object({ name: nameField, email: emailField, password: newPasswordField });

type Values = z.infer<typeof schema>;

function SignUpPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const submit = handleSubmit(async (values) => {
    setFormError(null);

    try {
      await registerAccount(values);

      const user = await login({ email: values.email, password: values.password });

      setSession(queryClient, user);
      queryClient.removeQueries({ queryKey: queryKeys.workspaces() });
      await navigate({ to: '/', replace: true });
    } catch (error) {
      setFormError(errorMessage(error));
    }
  });

  return (
    <AuthLayout
      title="Criar conta"
      description="Em seguida você cria ou entra em um workspace."
      footer={
        <>
          Já tem conta? <Link to="/login">Entrar</Link>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        {formError ? <FormAlert>{formError}</FormAlert> : null}

        <Field id="name" label="Nome completo" error={errors.name?.message}>
          <Input
            id="name"
            autoComplete="name"
            autoFocus
            placeholder="Felipe Souza"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'name-error' : undefined}
            {...field('name')}
          />
        </Field>

        <Field id="email" label="E-mail" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="voce@azuos.dev"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'email-error' : undefined}
            {...field('email')}
          />
        </Field>

        <Field id="password" label="Senha" hint={PASSWORD_MESSAGE} error={errors.password?.message}>
          <PasswordField
            id="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'password-error' : 'password-hint'}
            {...field('password')}
          />
        </Field>

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Spinner label="Criando conta" /> : 'Criar conta'}
        </Button>
      </form>
    </AuthLayout>
  );
}

export const Route = createFileRoute('/_public/cadastro')({ component: SignUpPage });
