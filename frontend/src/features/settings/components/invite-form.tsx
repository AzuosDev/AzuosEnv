import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { AssignableRole } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SelectNative } from '@/components/ui/select-native';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { Field } from '@/features/auth/components/field';
import { emailField } from '@/lib/validation';
import { createInvite } from '../api';
import { ASSIGNABLE_ROLES, ROLE_LABELS } from '../roles';
import { SettingsCard } from './settings-card';

const schema = z.object({
  email: emailField,
  role: z.enum(['admin', 'member', 'limited', 'guest']),
});

type Values = z.infer<typeof schema>;

/** Convite por e-mail com o papel que a pessoa vai ter. */
export function InviteForm({ wsId }: { wsId: string }) {
  const queryClient = useQueryClient();
  const {
    register: field,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', role: 'member' },
  });

  const invite = useMutation({
    mutationFn: (values: Values) => createInvite(wsId, values),
    onSuccess: async (created, values) => {
      reset({ email: '', role: values.role });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.invites(wsId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.members(wsId) }),
      ]);

      if (created.emailSent) {
        toast.success(`Convite enviado para ${values.email}.`);

        return;
      }

      // O convite existe e o link é válido: sem o e-mail, resta entregar o link.
      toast.warning(`Convite criado, mas o e-mail não pôde ser enviado.`, {
        description: 'Copie o link e envie para a pessoa.',
        action: {
          label: 'Copiar link',
          onClick: () => {
            void navigator.clipboard.writeText(created.acceptUrl);
          },
        },
      });
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const submit = handleSubmit((values) => invite.mutateAsync(values).catch(() => undefined));

  return (
    <SettingsCard
      title="Convidar pessoa"
      description="O convite chega por e-mail e vale por 7 dias."
    >
      <form className="flex flex-col gap-3 md:flex-row md:items-end" onSubmit={submit} noValidate>
        <div className="flex-1">
          <Field id="invite-email" label="E-mail" error={errors.email?.message}>
            <Input
              id="invite-email"
              type="email"
              inputMode="email"
              placeholder="nome@empresa.com"
              aria-invalid={Boolean(errors.email)}
              {...field('email')}
            />
          </Field>
        </div>

        <div className="md:w-52">
          <Field id="invite-role" label="Papel" error={errors.role?.message}>
            <SelectNative id="invite-role" {...field('role')}>
              {ASSIGNABLE_ROLES.map((role: AssignableRole) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </SelectNative>
          </Field>
        </div>

        <Button type="submit" disabled={isSubmitting} className="md:mb-0">
          {isSubmitting ? <Spinner label="Convidando" /> : 'Convidar'}
        </Button>
      </form>
    </SettingsCard>
  );
}
