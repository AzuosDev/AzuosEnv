import { zodResolver } from '@hookform/resolvers/zod';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { errorMessage } from '@/api/errors';
import { Button } from '@/components/ui/button';
import { forgotPassword } from '@/features/auth/api';
import { AuthCardTitle, AuthGlassLayout } from '@/features/auth/components/auth-glass-layout';
import {
  GLASS_SECONDARY,
  GLASS_SUBMIT,
  GlassField,
  GlassFormError,
  GlassInput,
} from '@/features/auth/components/glass-field';
import { emailField } from '@/lib/validation';

const schema = z.object({ email: emailField });

type Values = z.infer<typeof schema>;

const ERROR_ID = 'acesso-erro';

/** Link de volta para o login, no lugar do "Voltar para entrar" do protótipo. */
function BackToLogin() {
  return (
    <Button asChild variant="glass" className={GLASS_SECONDARY}>
      <Link to="/login" className="no-underline">
        Voltar para entrar
      </Link>
    </Button>
  );
}

function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '' } });

  const submit = handleSubmit(async (values) => {
    setFormError(null);

    try {
      await forgotPassword(values.email);
      setSentTo(values.email);
    } catch (error) {
      setFormError(errorMessage(error));
    }
  });

  if (sentTo) {
    return (
      <AuthGlassLayout>
        <div className="flex flex-col gap-5">
          <AuthCardTitle title="Confira seu e-mail" />
          <p className="m-0 leading-relaxed text-body">
            Enviamos um link para {sentTo}. Ele vale por 30 minutos.
          </p>
          <BackToLogin />
        </div>
      </AuthGlassLayout>
    );
  }

  const message = formError ?? errors.email?.message;

  return (
    <AuthGlassLayout>
      <div className="flex flex-col gap-6">
        <AuthCardTitle
          title="Esqueci minha senha"
          greeting="Informe o e-mail da conta e enviamos o link para criar uma senha nova."
        />

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

          <GlassFormError id={ERROR_ID}>{message}</GlassFormError>

          <Button type="submit" className={GLASS_SUBMIT} disabled={isSubmitting}>
            {isSubmitting ? 'Enviando…' : 'Enviar link'}
          </Button>
        </form>

        <BackToLogin />
      </div>
    </AuthGlassLayout>
  );
}

export const Route = createFileRoute('/_public/esqueci-senha')({ component: ForgotPasswordPage });
