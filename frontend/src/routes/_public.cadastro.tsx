import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import { Button } from '@/components/ui/button';
import { login, register as registerAccount } from '@/features/auth/api';
import { AuthCardTitle, AuthGlassLayout } from '@/features/auth/components/auth-glass-layout';
import {
  GLASS_SUBMIT,
  GlassField,
  GlassFormError,
  GlassInput,
  GlassPasswordInput,
} from '@/features/auth/components/glass-field';
import { GoogleAccess } from '@/features/auth/components/google-access';
import { setSession } from '@/features/auth/session';
import { emailField, nameField, newPasswordField, PASSWORD_MESSAGE } from '@/lib/validation';

const schema = z.object({ name: nameField, email: emailField, password: newPasswordField });

type Values = z.infer<typeof schema>;

const ERROR_ID = 'acesso-erro';

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

  const message =
    formError ?? errors.name?.message ?? errors.email?.message ?? errors.password?.message;

  return (
    <AuthGlassLayout>
      <div className="flex flex-col gap-6">
        <AuthCardTitle title="Criar conta" greeting="Recebeu um convite? Crie seu acesso." />

        <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
          <GlassField id="name" label="Nome">
            <GlassInput
              id="name"
              autoComplete="name"
              autoFocus
              placeholder="Como a equipe te chama"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={message ? ERROR_ID : undefined}
              {...field('name')}
            />
          </GlassField>

          <GlassField id="email" label="E-mail">
            <GlassInput
              id="email"
              inputMode="email"
              autoComplete="email"
              placeholder="voce@azuosdev.com.br"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={message ? ERROR_ID : undefined}
              {...field('email')}
            />
          </GlassField>

          <GlassField id="password" label="Senha" hint={PASSWORD_MESSAGE}>
            <GlassPasswordInput
              id="password"
              autoComplete="new-password"
              placeholder="Crie uma senha"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={message ? ERROR_ID : 'password-hint'}
              {...field('password')}
            />
          </GlassField>

          <GlassFormError id={ERROR_ID}>{message}</GlassFormError>

          <Button type="submit" className={GLASS_SUBMIT} disabled={isSubmitting}>
            {isSubmitting ? 'Criando conta…' : 'Criar conta'}
          </Button>
        </form>

        <GoogleAccess />

        <p className="m-0 text-center text-[14.5px] text-body">
          Já tem conta?{' '}
          <Link to="/login" className="font-semibold text-ink no-underline hover:text-accent">
            Entrar
          </Link>
        </p>
      </div>
    </AuthGlassLayout>
  );
}

export const Route = createFileRoute('/_public/cadastro')({ component: SignUpPage });
