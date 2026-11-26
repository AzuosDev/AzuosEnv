import { BellRing } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { notificationsSupported, shouldAskForPush } from '../push';
import { pushAskSnoozed, snoozePushAsk } from '../push-ask-store';
import { usePush } from '../use-push';

/** O convite não disputa com a primeira pintura da tela. */
const DELAY_MS = 1200;

/**
 * Convite para ligar o aviso do sistema, logo ao entrar no workspace. O prompt
 * do navegador só aparece depois do clique: pedido sem contexto vira bloqueio
 * permanente, e bloqueio só o próprio navegador reverte. Some assim que o
 * navegador decide e volta duas semanas depois de "Agora não".
 */
export function PushAskBanner() {
  const push = usePush();
  const [snoozed, setSnoozed] = useState(() => pushAskSnoozed());
  const [visible, setVisible] = useState(false);
  const ask = shouldAskForPush({
    supported: notificationsSupported(),
    permission: push.permission,
    snoozed,
  });

  useEffect(() => {
    if (!ask) {
      setVisible(false);

      return;
    }

    const timer = window.setTimeout(() => {
      setVisible(true);
    }, DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [ask]);

  if (!visible) {
    return null;
  }

  return (
    <section
      aria-label="Notificações do sistema"
      className="flex items-start gap-3 border-b border-line bg-surface px-3 py-3 md:px-6"
    >
      <BellRing aria-hidden className="mt-3 size-4 shrink-0 text-accent md:mt-2" />
      <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-6">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-ink">Receber avisos no computador</p>
          <p className="text-[13px] text-muted">
            Menção, tarefa atribuída e prazo aparecem na área de trabalho, mesmo com o Azuos Env em
            outra aba.
          </p>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 md:w-auto md:flex-row">
          <Button
            variant="ghost"
            onClick={() => {
              snoozePushAsk();
              setSnoozed(true);
            }}
          >
            Agora não
          </Button>
          <Button
            variant="outline"
            disabled={push.busy}
            onClick={() => {
              void push.enable();
            }}
          >
            Ativar notificações
          </Button>
        </div>
      </div>
    </section>
  );
}
