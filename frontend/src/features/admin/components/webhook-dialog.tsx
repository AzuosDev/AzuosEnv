import { useMutation } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';
import { errorMessage } from '@/api/errors';
import type { OutgoingWebhook, OutgoingWebhookEvent } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { WEBHOOK_EVENTS, WEBHOOK_EVENT_LABEL } from '../labels';
import { createWebhook, updateWebhook } from '../api';

export interface WebhookDialogProps {
  wsId: string;
  open: boolean;
  /** null cria; o webhook edita. */
  webhook: OutgoingWebhook | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (secret: string | null) => void;
}

/** Cria ou edita o webhook de saída: URL, eventos e se está ativo. */
export function WebhookDialog({ wsId, open, webhook, onOpenChange, onSaved }: WebhookDialogProps) {
  const urlId = useId();
  const activeId = useId();
  const rotateId = useId();
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<OutgoingWebhookEvent[]>(['task.created']);
  const [active, setActive] = useState(true);
  const [rotate, setRotate] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setUrl(webhook?.url ?? '');
    setEvents(webhook?.events ?? ['task.created']);
    setActive(webhook?.active ?? true);
    setRotate(false);
  }, [open, webhook]);

  const save = useMutation({
    mutationFn: () =>
      webhook
        ? updateWebhook(wsId, webhook.id, {
            url: url.trim(),
            events,
            active,
            ...(rotate ? { rotateSecret: true } : {}),
          })
        : createWebhook(wsId, { url: url.trim(), events, active }),
    onSuccess: (result) => {
      onSaved(result.secret);
      toast.success(webhook ? 'Webhook atualizado.' : 'Webhook criado.');
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));
    },
  });

  const toggleEvent = (event: OutgoingWebhookEvent, checked: boolean): void => {
    setEvents((current) =>
      checked ? [...current, event] : current.filter((item) => item !== event),
    );
  };

  const valid = /^https?:\/\/.+/.test(url.trim()) && events.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{webhook ? 'Editar webhook' : 'Novo webhook'}</DialogTitle>
          <DialogDescription>
            O Azuos Env manda um POST assinado para a URL a cada evento escolhido.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={urlId}>URL de destino</Label>
            <Input
              id={urlId}
              type="url"
              placeholder="https://hooks.azuos.dev/env"
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
              }}
            />
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-[13px] font-medium text-ink">Eventos</legend>
            {WEBHOOK_EVENTS.map((event) => (
              <label key={event} className="flex min-h-11 items-center gap-2 md:min-h-0">
                <Checkbox
                  checked={events.includes(event)}
                  onCheckedChange={(checked) => {
                    toggleEvent(event, checked === true);
                  }}
                />
                <span className="text-[13px] text-body">{WEBHOOK_EVENT_LABEL[event]}</span>
              </label>
            ))}
          </fieldset>

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor={activeId}>Ativo</Label>
            <Switch id={activeId} checked={active} onCheckedChange={setActive} />
          </div>

          {webhook ? (
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor={rotateId}>Gerar um secret novo</Label>
              <Switch id={rotateId} checked={rotate} onCheckedChange={setRotate} />
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onOpenChange(false);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="signal" disabled={!valid || save.isPending}>
              {webhook ? 'Salvar' : 'Criar webhook'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
