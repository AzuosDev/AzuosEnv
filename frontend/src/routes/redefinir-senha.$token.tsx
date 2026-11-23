import { zodResolver } from '@hookform/resolvers/zod';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { errorMessage } from '@/api/errors';
import { Button } from '@/components/ui/button';
import { isResetTokenValid, resetPassword } from '@/features/auth/api';
import { AuthCardTitle, AuthGlassLayout } from '@/features/auth/components/auth-glass-layout';
import {
  GLASS_SECONDARY,
  GLASS_SUBMIT,
  GlassField,
  GlassFormError,
  GlassPasswordInput,
} from '@/features/auth/components/glass-field';
import { newPasswordField, PASSWORD_MESSAGE } from '@/lib/validation';

const schema = z
  .object({ password: newPasswordField, confirm: z.string() })
  .refine((values) => values.password === values.confirm, {
    path: ['confirm'],
    message: 'As senhas não são iguais.',
  });

type Values = z.infer<typeof schema>;

const ERROR_ID = 'acesso-erro';

/** Link vencido ou já usado: o caminho é pedir outro. */
function ExpiredLink() {
  return (
    <AuthGlassLayout>
      <div className="flex flex-col gap-5">
        <AuthCardTitle title="Este link expirou ou já foi usado" />
        <p className="m-0 leading-relaxed text-body">
          Cada link vale por 30 minutos e só pode ser usado uma vez. Peça outro para continuar.
        </p>
        <Button asChild className={GLASS_SUBMIT}>
          <Link to="/esqueci-senha" className="no-underline">
            Pedir outro link
          </Link>
        </Button>
        <Button asChild variant="glass" className={GLASS_SECONDARY}>
          <Link to="/login" className="no-underline">
            Voltar para entrar
          </Link>
        </Button>
      </div>
    </AuthGlassLayout>
  );
}

function ResetPasswordPage() {
  const { token } = Route.useParams();
  const { valid } = Route.useLoaderData();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirm: '' },
  });

  const submit = handleSubmit(async (values) => {
    setFormError(null);

    try {
      await resetPassword({ token, password: values.password });
      await navigate({ to: '/login', search: { redefinida: true }, replace: true });
    } catch (error) {
      setFormError(errorMessage(error));
    }
  });

  if (!valid) {
    return <ExpiredLink />;
  }

  const message = formError ?? errors.password?.message ?? errors.confirm?.message;

  return (
    <AuthGlassLayout>
      <div className="flex flex-col gap-6">
        <AuthCardTitle
          title="Nova senha"
          greeting="Crie a senha que você vai usar para entrar no Azuos Env."
        />

        <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
          <GlassField id="password" label="Nova senha" hint={PASSWORD_MESSAGE}>
            <GlassPasswordInput
              id="password"
              autoComplete="new-password"
              autoFocus
              placeholder="Crie uma senha"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={message ? ERROR_ID : 'password-hint'}
              {...field('password')}
            />
          </GlassField>

          <GlassField id="confirm" label="Confirmar senha">
            <GlassPasswordInput
              id="confirm"
              autoComplete="new-password"
              placeholder="Repita a senha"
              aria-invalid={Boolean(errors.confirm)}
              aria-describedby={message ? ERROR_ID : undefined}
              {...field('confirm')}
            />
          </GlassField>

          <GlassFormError id={ERROR_ID}>{message}</GlassFormError>

          <Button type="submit" className={GLASS_SUBMIT} disabled={isSubmitting}>
            {isSubmitting ? 'Redefinindo…' : 'Redefinir senha'}
          </Button>
        </form>
      </div>
    </AuthGlassLayout>
  );
}

/** Enquanto a API responde se o link vale. */
function ValidatingLink() {
  return (
    <AuthGlassLayout>
      <div className="flex flex-col gap-5">
        <AuthCardTitle title="Nova senha" />
        <p className="m-0 text-body" role="status">
          Conferindo o link…
        </p>
      </div>
    </AuthGlassLayout>
  );
}

export const Route = createFileRoute('/redefinir-senha/$token')({
  loader: async ({ params }): Promise<{ valid: boolean }> => ({
    valid: await isResetTokenValid(params.token),
  }),
  pendingMs: 0,
  pendingComponent: ValidatingLink,
  component: ResetPasswordPage,
});
