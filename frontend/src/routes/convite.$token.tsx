import { zodResolver } from '@hookform/resolvers/zod';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { errorMessage } from '@/api/errors';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { acceptInvite } from '@/features/auth/api';
import { AuthCardTitle, AuthGlassLayout } from '@/features/auth/components/auth-glass-layout';
import {
  GLASS_SUBMIT,
  GlassField,
  GlassFormError,
  GlassInput,
  GlassPasswordInput,
} from '@/features/auth/components/glass-field';
import { GoogleAccess } from '@/features/auth/components/google-access';
import { PASSWORD_MESSAGE, PASSWORD_PATTERN } from '@/lib/validation';

const schema = z
  .object({
    name: z.string().trim().max(120, 'Nome muito longo.'),
    password: z.string().max(128, 'Senha muito longa.'),
  })
  .refine((values) => values.password === '' || PASSWORD_PATTERN.test(values.password), {
    path: ['password'],
    message: PASSWORD_MESSAGE,
  })
  .refine((values) => values.password === '' || values.name.length >= 2, {
    path: ['name'],
    message: 'Informe o nome completo.',
  });

type Values = z.infer<typeof schema>;

const ERROR_ID = 'acesso-erro';

function AcceptInvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: '', password: '' } });

  const submit = handleSubmit(async (values) => {
    setFormError(null);

    try {
      const accepted = await acceptInvite({
        token,
        ...(values.name ? { name: values.name } : {}),
        ...(values.password ? { password: values.password } : {}),
      });

      toast.success(`Convite aceito: ${accepted.workspace.name}`, {
        description: 'Entre para continuar.',
      });
      await navigate({ to: '/login', replace: true });
    } catch (error) {
      setFormError(errorMessage(error));
    }
  });

  const message = formError ?? errors.name?.message ?? errors.password?.message;

  return (
    <AuthGlassLayout>
      <div className="flex flex-col gap-6">
        <AuthCardTitle
          title="Aceitar convite"
          greeting="Você foi convidado para um workspace da Azuos Env."
        />

        <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
          <p className="m-0 text-[13.5px] leading-relaxed text-body">
            Ainda não tem conta? Informe nome e senha para criá-la. Se já tem conta, deixe os campos
            em branco e aceite o convite.
          </p>

          <GlassField id="name" label="Nome">
            <GlassInput
              id="name"
              autoComplete="name"
              placeholder="Como a equipe te chama"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={message ? ERROR_ID : undefined}
              {...field('name')}
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
            {isSubmitting ? 'Aceitando convite…' : 'Aceitar convite'}
          </Button>
        </form>

        <GoogleAccess invite={token} />

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

export const Route = createFileRoute('/convite/$token')({ component: AcceptInvitePage });
