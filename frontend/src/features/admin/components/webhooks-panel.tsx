import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Webhook } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { OutgoingWebhook } from '@/api/types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusPill } from '@/components/ui/status-pill';
import { toast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/features/settings/components/confirm-dialog';
import { SettingsCard } from '@/features/settings/components/settings-card';
import { WEBHOOK_EVENT_LABEL } from '../labels';
import { deleteWebhook, webhooksQuery } from '../api';
import { DeliveriesDialog } from './deliveries-dialog';
import { SecretNotice } from './secret-notice';
import { WebhookDialog } from './webhook-dialog';

function eventsLabel(webhook: OutgoingWebhook): string {
  return webhook.events.map((event) => WEBHOOK_EVENT_LABEL[event]).join(', ');
}

/** Webhooks de saída do workspace: CRUD, log de entregas e reenvio. */
export function WebhooksPanel({ wsId }: { wsId: string }) {
  const queryClient = useQueryClient();
  const webhooks = useQuery(webhooksQuery(wsId));
  const [editing, setEditing] = useState<{ webhook: OutgoingWebhook | null } | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [removing, setRemoving] = useState<OutgoingWebhook | null>(null);
  const [showing, setShowing] = useState<OutgoingWebhook | null>(null);

  const refresh = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: queryKeys.webhooks(wsId) });

  const remove = useMutation({
    mutationFn: (webhookId: string) => deleteWebhook(wsId, webhookId),
    onSuccess: async () => {
      setRemoving(null);
      await refresh();
      toast.success('Webhook removido com o log de entregas.');
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const items = webhooks.data ?? [];

  return (
    <>
      <SettingsCard
        title="Webhooks de saída"
        description="Cada evento vai num POST assinado com HMAC no header X-Azuos-Signature-256."
        actions={
          <Button
            size="sm"
            onClick={() => {
              setSecret(null);
              setEditing({ webhook: null });
            }}
          >
            Novo webhook
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          {secret ? (
            <SecretNotice
              label="Secret do webhook"
              value={secret}
              warning="Guarde agora: o servidor não mostra de novo. Ele assina o corpo de cada entrega."
            />
          ) : null}

          {items.length === 0 ? (
            <EmptyState
              title="Nenhum webhook"
              description="Avise outro sistema quando uma tarefa, comentário ou quadro mudar."
              icon={<Webhook className="h-7 w-7" aria-hidden="true" />}
            />
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {items.map((webhook) => (
                <li
                  key={webhook.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-ink">{webhook.url}</p>
                    <p className="mt-0.5 text-[12.5px] text-muted">
                      {eventsLabel(webhook)}
                      {' · '}
                      {webhook.lastDeliveryAt
                        ? `última entrega ${format(
                            new Date(webhook.lastDeliveryAt),
                            "d 'de' MMM', às' HH:mm",
                            { locale: ptBR },
                          )}`
                        : 'nenhuma entrega ainda'}
                    </p>
                  </div>
                  <span className="flex flex-wrap items-center gap-2">
                    <StatusPill tone={webhook.active ? 'success' : 'neutral'}>
                      {webhook.active ? 'Ativo' : 'Pausado'}
                    </StatusPill>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Ver entregas de ${webhook.url}`}
                      onClick={() => {
                        setShowing(webhook);
                      }}
                    >
                      Entregas
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Editar ${webhook.url}`}
                      onClick={() => {
                        setSecret(null);
                        setEditing({ webhook });
                      }}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Remover ${webhook.url}`}
                      onClick={() => {
                        setRemoving(webhook);
                      }}
                    >
                      Remover
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SettingsCard>

      <WebhookDialog
        wsId={wsId}
        open={editing !== null}
        webhook={editing?.webhook ?? null}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
          }
        }}
        onSaved={(newSecret) => {
          setEditing(null);
          setSecret(newSecret);
          void refresh();
        }}
      />

      <DeliveriesDialog
        wsId={wsId}
        webhook={showing}
        onOpenChange={(open) => {
          if (!open) {
            setShowing(null);
          }
        }}
      />

      <ConfirmDialog
        open={removing !== null}
        title="Remover webhook"
        description="O log de entregas vai junto e não dá para desfazer."
        confirmLabel="Remover"
        danger
        pending={remove.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setRemoving(null);
          }
        }}
        onConfirm={() => {
          if (removing) {
            remove.mutate(removing.id);
          }
        }}
      />
    </>
  );
}
