import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { AssignableRole, WorkspaceInvite } from '@/api/types';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { cancelInvite, createInvite, invitesQuery } from '../api';
import { ROLE_LABELS } from '../roles';
import { SettingsCard, SettingsRow } from './settings-card';

/** Convites que ainda não foram aceitos: reenviar ou cancelar. */
export function InvitesList({ wsId }: { wsId: string }) {
  const queryClient = useQueryClient();
  const { data: invites } = useSuspenseQuery(invitesQuery(wsId));

  const refresh = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: queryKeys.invites(wsId) });

  const resend = useMutation({
    mutationFn: (invite: WorkspaceInvite) =>
      createInvite(wsId, { email: invite.email, role: invite.role as AssignableRole }),
    onSuccess: async (_result, invite) => {
      await refresh();
      toast.success(`Convite reenviado para ${invite.email}.`);
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const cancel = useMutation({
    mutationFn: (inviteId: string) => cancelInvite(wsId, inviteId),
    onSuccess: async () => {
      await Promise.all([
        refresh(),
        queryClient.invalidateQueries({ queryKey: queryKeys.members(wsId) }),
      ]);
      toast.success('Convite cancelado.');
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const busy = resend.isPending || cancel.isPending;

  return (
    <SettingsCard
      title="Convites pendentes"
      description="Enquanto o convite não é aceito, ele pode ser reenviado ou cancelado."
    >
      {invites.length === 0 ? (
        <p className="text-[13px] text-muted">Nenhum convite esperando resposta.</p>
      ) : (
        <div className="flex flex-col">
          {invites.map((invite, index) => (
            <SettingsRow
              key={invite.id}
              last={index === invites.length - 1}
              title={invite.email}
              description={`${ROLE_LABELS[invite.role]} · expira em ${format(
                new Date(invite.expiresAt),
                "d 'de' MMM yyyy",
                { locale: ptBR },
              )}`}
              control={
                <span className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      resend.mutate(invite);
                    }}
                  >
                    Reenviar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    aria-label={`Cancelar convite de ${invite.email}`}
                    onClick={() => {
                      cancel.mutate(invite.id);
                    }}
                  >
                    Cancelar
                  </Button>
                </span>
              }
            />
          ))}
        </div>
      )}
    </SettingsCard>
  );
}
