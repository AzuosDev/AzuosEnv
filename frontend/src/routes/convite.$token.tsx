import { zodResolver } from '@hookform/resolvers/zod';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { Lock, User } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { errorMessage } from '@/api/errors';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { acceptInvite } from '@/features/auth/api';
import { AccessLayout } from '@/features/auth/components/access-layout';
import { Field, FormAlert } from '@/features/auth/components/field';
import { IconInput } from '@/features/auth/components/icon-input';
import { PasswordField } from '@/features/auth/components/password-field';
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

  return (
    <AccessLayout
      title="Aceitar convite"
      description="Você foi convidado para um workspace da Azuos Env."
      footer={
        <>
          Já tem conta?{' '}
          <Link to="/login" className="font-semibold">
            Entrar
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={submit} noValidate>
        {formError ? <FormAlert>{formError}</FormAlert> : null}

        <p className="text-[13px] text-body">
          Ainda não tem conta? Informe nome e senha para criá-la. Se já tem conta, deixe os campos
          em branco e aceite o convite.
        </p>

        <Field id="name" label="Nome completo" error={errors.name?.message}>
          <IconInput
            icon={User}
            id="name"
            autoComplete="name"
            placeholder="Felipe Souza"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'name-error' : undefined}
            {...field('name')}
          />
        </Field>

        <Field id="password" label="Senha" hint={PASSWORD_MESSAGE} error={errors.password?.message}>
          <PasswordField
            icon={Lock}
            id="password"
            placeholder="Crie uma senha"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'password-error' : 'password-hint'}
            {...field('password')}
          />
        </Field>

        <Button type="submit" size="lg" className="w-full rounded-full" disabled={isSubmitting}>
          {isSubmitting ? <Spinner label="Aceitando convite" /> : 'Aceitar convite'}
        </Button>
      </form>
    </AccessLayout>
  );
}

export const Route = createFileRoute('/convite/$token')({ component: AcceptInvitePage });
