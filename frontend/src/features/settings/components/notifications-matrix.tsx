import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { NotificationKind, NotificationPreferences } from '@/api/types';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/toast';
import { notificationSettingsQuery, updateNotificationSettings } from '../api';
import { NOTIFICATION_CHANNELS, NOTIFICATION_KINDS } from '../notification-kinds';
import { SettingsCard } from './settings-card';

type Channel = 'inbox' | 'email';

/** Matriz tipo × canal das notification_settings. */
export function NotificationsMatrix() {
  const queryClient = useQueryClient();
  const { data: settings } = useSuspenseQuery(notificationSettingsQuery);

  const save = useMutation({
    mutationFn: (change: { kind: NotificationKind; channel: Channel; on: boolean }) =>
      updateNotificationSettings({ types: { [change.kind]: { [change.channel]: change.on } } }),
    onMutate: (change) => {
      const previous = queryClient.getQueryData<NotificationPreferences>(
        queryKeys.notificationSettings(),
      );

      if (previous) {
        queryClient.setQueryData<NotificationPreferences>(queryKeys.notificationSettings(), {
          ...previous,
          [change.kind]: { ...previous[change.kind], [change.channel]: change.on },
        });
      }

      return { previous };
    },
    onError: (error: unknown, _change, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.notificationSettings(), context.previous);
      }

      toast.error(errorMessage(error));
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.notificationSettings(), updated);
    },
  });

  return (
    <SettingsCard
      title="Canais por tipo"
      description="Escolha onde cada aviso chega. O Inbox mostra dentro do app; o e-mail sai para a sua caixa."
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[260px] border-collapse text-[13px]">
          <caption className="sr-only">Canais de cada tipo de notificação</caption>
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className="py-2 pr-3 text-[12px] font-medium text-muted">
                Tipo
              </th>
              {NOTIFICATION_CHANNELS.map((channel) => (
                <th
                  key={channel.id}
                  scope="col"
                  className="w-16 py-2 text-center text-[12px] font-medium text-muted"
                >
                  {channel.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {NOTIFICATION_KINDS.map((kind) => (
              <tr key={kind.id} className="border-b border-line last:border-0">
                <th scope="row" className="py-2.5 pr-3 text-left font-normal text-body">
                  {kind.label}
                </th>
                {NOTIFICATION_CHANNELS.map((channel) => (
                  <td key={channel.id} className="py-2.5 text-center">
                    <span className="inline-flex h-11 w-11 items-center justify-center">
                      <Checkbox
                        checked={settings[kind.id][channel.id]}
                        disabled={save.isPending}
                        aria-label={`${kind.label} — ${channel.label}`}
                        onCheckedChange={(checked) => {
                          save.mutate({
                            kind: kind.id,
                            channel: channel.id,
                            on: checked === true,
                          });
                        }}
                      />
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SettingsCard>
  );
}
