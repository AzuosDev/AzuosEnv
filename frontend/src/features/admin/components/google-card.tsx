import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useId } from 'react';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SelectNative } from '@/components/ui/select-native';
import { StatusPill } from '@/components/ui/status-pill';
import { toast } from '@/components/ui/toast';
import { SettingsCard, SettingsRow } from '@/features/settings/components/settings-card';
import {
  chooseGoogleCalendar,
  disconnectGoogle,
  googleAuthUrl,
  googleCalendarsQuery,
  googleIntegrationQuery,
} from '../api';

/** Conta do Google de quem está vendo: conectar, escolher agenda e desconectar. */
export function GoogleCard({ wsId }: { wsId: string }) {
  const queryClient = useQueryClient();
  const calendarId = useId();
  const status = useQuery(googleIntegrationQuery(wsId));
  const calendars = useQuery(googleCalendarsQuery(wsId, status.data?.connected === true));

  const refresh = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.googleIntegration(wsId) });
    await queryClient.invalidateQueries({ queryKey: queryKeys.googleCalendars(wsId) });
  };

  const connect = useMutation({
    mutationFn: () => googleAuthUrl(wsId),
    onSuccess: (url) => {
      window.location.assign(url);
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const choose = useMutation({
    mutationFn: (value: string) => chooseGoogleCalendar(wsId, value),
    onSuccess: async () => {
      await refresh();
      toast.success('Agenda escolhida.');
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const disconnect = useMutation({
    mutationFn: () => disconnectGoogle(wsId),
    onSuccess: async () => {
      await refresh();
      toast.success('Conta do Google desconectada.');
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const connected = status.data?.connected === true;
  const available = status.data?.available === true;
  const options = calendars.data ?? [];

  return (
    <SettingsCard
      title="Google Agenda"
      description="A conta é sua: cada pessoa conecta a própria agenda e o Planner usa a dela."
    >
      <div className="flex flex-col">
        <SettingsRow
          title="Conta"
          description={
            connected
              ? (status.data?.email ?? 'Conta conectada')
              : available
                ? 'Nenhuma conta conectada neste workspace.'
                : 'O servidor não tem credencial do Google configurada (GOOGLE_CLIENT_ID).'
          }
          control={
            <span className="flex items-center gap-2">
              <StatusPill tone={connected ? 'success' : available ? 'neutral' : 'warning'}>
                {connected ? 'Conectada' : available ? 'Desconectada' : 'Indisponível'}
              </StatusPill>
              {connected ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={disconnect.isPending}
                  onClick={() => {
                    disconnect.mutate();
                  }}
                >
                  Desconectar
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={!available || connect.isPending}
                  onClick={() => {
                    connect.mutate();
                  }}
                >
                  Conectar Google Agenda
                </Button>
              )}
            </span>
          }
        />

        <SettingsRow
          title="Agenda sincronizada"
          description={
            connected
              ? options.length > 0
                ? 'Os eventos do Planner vão e voltam desta agenda.'
                : 'Não foi possível ler as agendas da conta agora; a principal continua valendo.'
              : 'Conecte a conta para escolher a agenda.'
          }
          control={
            <div className="w-full sm:w-64">
              <Label className="sr-only" htmlFor={calendarId}>
                Agenda sincronizada
              </Label>
              <SelectNative
                id={calendarId}
                disabled={!connected || choose.isPending}
                value={status.data?.calendarId ?? 'primary'}
                onChange={(event) => {
                  choose.mutate(event.target.value);
                }}
              >
                {options.length === 0 ? (
                  <option value={status.data?.calendarId ?? 'primary'}>Agenda principal</option>
                ) : null}
                {options.map((calendar) => (
                  <option key={calendar.id} value={calendar.id}>
                    {calendar.name}
                    {calendar.primary ? ' (principal)' : ''}
                    {calendar.writable ? '' : ' — só leitura'}
                  </option>
                ))}
              </SelectNative>
            </div>
          }
        />

        <SettingsRow
          last
          title="Última sincronização"
          description={
            status.data?.syncedAt
              ? format(new Date(status.data.syncedAt), "d 'de' MMMM', às' HH:mm", { locale: ptBR })
              : 'Ainda não sincronizou.'
          }
        />
      </div>
    </SettingsCard>
  );
}
