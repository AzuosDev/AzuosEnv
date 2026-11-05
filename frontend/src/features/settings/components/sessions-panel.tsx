import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';
import { toast } from '@/components/ui/toast';
import { useLogout } from '@/features/auth/hooks/use-logout';
import { revokeSession, sessionsQuery } from '../api';
import { deviceLabel } from '../user-agent';
import { SettingsCard, SettingsRow } from './settings-card';

function since(value?: string): string {
  if (!value) {
    return 'início desconhecido';
  }

  return `desde ${format(new Date(value), "d 'de' MMM yyyy', às' HH:mm", { locale: ptBR })}`;
}

/** Sessões ativas: encerra uma a uma ou todas de uma vez. */
export function SessionsPanel() {
  const queryClient = useQueryClient();
  const logout = useLogout();
  const { data: sessions } = useSuspenseQuery(sessionsQuery);

  const revoke = useMutation({
    mutationFn: (id: string) => revokeSession(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.sessions() });
      toast.success('Sessão encerrada.');
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const others = sessions.filter((item) => !item.current).length;

  return (
    <SettingsCard
      title="Sessões ativas"
      description="Cada aparelho que entrou na sua conta. Encerrar todas também encerra esta."
      actions={
        <Button
          variant="ghost"
          size="sm"
          disabled={logout.isPending}
          onClick={() => {
            logout.mutate('all');
          }}
        >
          Encerrar todas
        </Button>
      }
    >
      <div className="flex flex-col">
        {sessions.map((item, index) => (
          <SettingsRow
            key={item.id}
            last={index === sessions.length - 1}
            title={
              <span className="flex flex-wrap items-center gap-2">
                {deviceLabel(item.userAgent)}
                {item.current ? <StatusPill tone="success">Esta sessão</StatusPill> : null}
              </span>
            }
            description={`${since(item.createdAt)}${item.ip ? ` · ${item.ip}` : ''}`}
            control={
              item.current ? null : (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={revoke.isPending}
                  onClick={() => {
                    revoke.mutate(item.id);
                  }}
                >
                  Encerrar
                </Button>
              )
            }
          />
        ))}
      </div>

      {others === 0 ? (
        <p className="pt-3 text-[12.5px] text-muted">
          Nenhum outro dispositivo com a sessão aberta.
        </p>
      ) : null}
    </SettingsCard>
  );
}
