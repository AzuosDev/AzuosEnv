import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { errorMessage } from '@/api/errors';
import type { AuthUser } from '@/api/types';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { Field } from '@/features/auth/components/field';
import { setSession } from '@/features/auth/session';
import { nameField } from '@/lib/validation';
import { updateProfile } from '../api';
import { LOCALES, TIMEZONES, withValue } from '../options';
import { SettingsCard } from './settings-card';
import { SelectField } from './select-field';

const schema = z.object({
  name: nameField,
  avatarUrl: z.union([
    z.literal(''),
    z.string().trim().url('Informe uma URL completa, começando com https://'),
  ]),
  timezone: z.string().min(1, 'Escolha o fuso horário.'),
  locale: z.string().min(1, 'Escolha o idioma.'),
});

type Values = z.infer<typeof schema>;

/** Perfil da conta: nome, avatar, fuso e idioma. */
export function ProfileForm({ user }: { user: AuthUser }) {
  const queryClient = useQueryClient();
  const {
    register: field,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: user.name,
      avatarUrl: user.avatarUrl ?? '',
      timezone: user.timezone,
      locale: user.locale,
    },
  });

  const save = useMutation({
    mutationFn: (values: Values) => updateProfile(values),
    onSuccess: (updated) => {
      setSession(queryClient, updated);
      reset({
        name: updated.name,
        avatarUrl: updated.avatarUrl ?? '',
        timezone: updated.timezone,
        locale: updated.locale,
      });
      toast.success('Perfil salvo.');
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const submit = handleSubmit((values) => save.mutateAsync(values).catch(() => undefined));
  const avatarUrl = watch('avatarUrl').trim();
  const name = watch('name');

  return (
    <SettingsCard title="Dados da conta" description="Como você aparece para a equipe.">
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        <div className="flex items-center gap-3">
          <Avatar
            name={name || user.name}
            {...(avatarUrl ? { src: avatarUrl } : {})}
            className="h-14 w-14"
          />
          <p className="text-[12.5px] text-muted">
            Sem URL de imagem, o avatar usa as iniciais do nome.
          </p>
        </div>

        <Field id="name" label="Nome completo" error={errors.name?.message}>
          <Input
            id="name"
            autoComplete="name"
            aria-invalid={Boolean(errors.name)}
            {...field('name')}
          />
        </Field>

        <Field
          id="avatarUrl"
          label="URL do avatar"
          hint="Deixe vazio para voltar às iniciais."
          error={errors.avatarUrl?.message}
        >
          <Input
            id="avatarUrl"
            type="url"
            inputMode="url"
            placeholder="https://..."
            aria-invalid={Boolean(errors.avatarUrl)}
            {...field('avatarUrl')}
          />
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <SelectField
            control={control}
            name="timezone"
            label="Fuso horário"
            options={withValue(TIMEZONES, user.timezone)}
            error={errors.timezone?.message}
          />
          <SelectField
            control={control}
            name="locale"
            label="Idioma"
            options={withValue(LOCALES, user.locale)}
            error={errors.locale?.message}
          />
        </div>

        <div className="flex">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Spinner label="Salvando" /> : 'Salvar perfil'}
          </Button>
        </div>
      </form>
    </SettingsCard>
  );
}
