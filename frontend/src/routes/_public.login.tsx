import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { z } from 'zod';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import { Button } from '@/components/ui/button';
import { login } from '@/features/auth/api';
import { AuthCardTitle, AuthGlassLayout } from '@/features/auth/components/auth-glass-layout';
import {
  GLASS_SUBMIT,
  GlassField,
  GlassFormError,
  GlassInput,
  GlassPasswordInput,
} from '@/features/auth/components/glass-field';
import { GoogleAccess } from '@/features/auth/components/google-access';
import { safeNext } from '@/features/auth/navigation';
import { setSession } from '@/features/auth/session';
import { currentPasswordField, emailField } from '@/lib/validation';

const schema = z.object({ email: emailField, password: currentPasswordField });

type Values = z.infer<typeof schema>;

const ERROR_ID = 'acesso-erro';

function LoginPage() {
  const { next, expirado, erro, redefinida } = Route.useSearch();
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

  const aviso = erro === 'google' ? 'Não foi possível entrar com o Google.' : null;
  const message =
    formError ??
    errors.email?.message ??
    errors.password?.message ??
    aviso ??
    (expirado ? 'Sua sessão expirou. Entre de novo para continuar.' : undefined);

  return (
    <AuthGlassLayout>
      <div className="flex flex-col gap-6">
        <AuthCardTitle title="Entrar" greeting="Bem-vindo de volta à Azuos." />

        {redefinida ? (
          <p
            role="status"
            className="m-0 rounded-xl border border-success/40 bg-success/10 px-3.5 py-2.5 text-[13.5px] text-ink"
          >
            Senha redefinida. Entre com a nova senha.
          </p>
        ) : null}

        <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
          <GlassField id="email" label="E-mail">
            <GlassInput
              id="email"
              inputMode="email"
              autoComplete="email"
              autoFocus
              placeholder="voce@azuosdev.com.br"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={message ? ERROR_ID : undefined}
              {...field('email')}
            />
          </GlassField>

          <GlassField id="password" label="Senha">
            <GlassPasswordInput
              id="password"
              autoComplete="current-password"
              placeholder="Sua senha"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={message ? ERROR_ID : undefined}
              {...field('password')}
            />
            <Link
              to="/esqueci-senha"
              className="self-end py-1 text-[13.5px] text-body no-underline hover:text-ink"
            >
              Esqueci minha senha
            </Link>
          </GlassField>

          <GlassFormError id={ERROR_ID}>{message}</GlassFormError>

          <Button type="submit" className={GLASS_SUBMIT} disabled={isSubmitting}>
            {isSubmitting ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>

        <GoogleAccess next={next} />

        <p className="m-0 text-center text-[14.5px] text-body">
          Novo na Azuos?{' '}
          <Link to="/cadastro" className="font-semibold text-ink no-underline hover:text-accent">
            Criar conta
          </Link>
        </p>
      </div>
    </AuthGlassLayout>
  );
}

export const Route = createFileRoute('/_public/login')({
  validateSearch: (
    search: Record<string, unknown>,
  ): { next?: string; expirado?: boolean; erro?: 'google'; redefinida?: boolean } => ({
    next: typeof search.next === 'string' ? search.next : undefined,
    expirado: search.expirado === true || search.expirado === 'true' ? true : undefined,
    erro: search.erro === 'google' ? 'google' : undefined,
    redefinida: search.redefinida === true || search.redefinida === 'true' ? true : undefined,
  }),
  component: LoginPage,
});
