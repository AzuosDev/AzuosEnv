import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { OutgoingWebhook } from '@/api/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StatusPill } from '@/components/ui/status-pill';
import { toast } from '@/components/ui/toast';
import { DELIVERY_STATUS_LABEL, DELIVERY_STATUS_TONE, WEBHOOK_EVENT_LABEL } from '../labels';
import { redeliverWebhook, webhookDeliveriesQuery } from '../api';

export interface DeliveriesDialogProps {
  wsId: string;
  webhook: OutgoingWebhook | null;
  onOpenChange: (open: boolean) => void;
}

/** Log de entregas do webhook, com reenvio de qualquer linha. */
export function DeliveriesDialog({ wsId, webhook, onOpenChange }: DeliveriesDialogProps) {
  const queryClient = useQueryClient();
  const webhookId = webhook?.id ?? '';
  const deliveries = useQuery({
    ...webhookDeliveriesQuery(wsId, webhookId),
    enabled: webhook !== null,
  });

  const resend = useMutation({
    mutationFn: (deliveryId: string) => redeliverWebhook(wsId, webhookId, deliveryId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.webhookDeliveries(wsId, webhookId),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.webhooks(wsId) });
      toast.success('Entrega reenviada.');
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const items = deliveries.data ?? [];

  return (
    <Dialog open={webhook !== null} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Entregas do webhook</DialogTitle>
          <DialogDescription>{webhook?.url ?? ''}</DialogDescription>
        </DialogHeader>

        {items.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-muted">
            {deliveries.isPending ? 'Carregando as entregas…' : 'Nenhuma entrega ainda.'}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line" aria-label="Entregas do webhook">
            {items.map((delivery) => (
              <li
                key={delivery.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium text-ink">
                    {WEBHOOK_EVENT_LABEL[delivery.event as keyof typeof WEBHOOK_EVENT_LABEL] ??
                      delivery.event}
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-muted">
                    {format(new Date(delivery.createdAt), "d 'de' MMM', às' HH:mm:ss", {
                      locale: ptBR,
                    })}
                    {' · '}
                    {delivery.attempts === 1
                      ? '1 tentativa'
                      : `${String(delivery.attempts)} tentativas`}
                    {delivery.statusCode === null ? '' : ` · HTTP ${String(delivery.statusCode)}`}
                    {delivery.error ? ` · ${delivery.error}` : ''}
                  </p>
                </div>
                <span className="flex items-center gap-2">
                  <StatusPill tone={DELIVERY_STATUS_TONE[delivery.status]}>
                    {DELIVERY_STATUS_LABEL[delivery.status]}
                  </StatusPill>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={resend.isPending || webhook?.active !== true}
                    onClick={() => {
                      resend.mutate(delivery.id);
                    }}
                  >
                    Reenviar
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
