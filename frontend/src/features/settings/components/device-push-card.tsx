import { BellOff, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePush } from '../use-push';
import { SettingsCard, SettingsRow } from './settings-card';

/** O que cada estado do push diz e oferece neste navegador. */
const COPY = {
  on: {
    title: 'Notificações ligadas neste dispositivo',
    description: 'Os avisos com o canal Push marcado chegam mesmo com o app fechado.',
  },
  off: {
    title: 'Notificações desligadas neste dispositivo',
    description: 'Ligue para receber aviso do sistema com o app fechado.',
  },
  blocked: {
    title: 'Notificações bloqueadas no navegador',
    description:
      'Libere o aviso para este site nas permissões do navegador e volte para ligar aqui.',
  },
  unconfigured: {
    title: 'Push indisponível no servidor',
    description: 'O administrador precisa configurar as chaves VAPID da API.',
  },
  unsupported: {
    title: 'Push indisponível neste navegador',
    description:
      'Abra o app instalado (ou um navegador com suporte a notificações) para usar este canal. No iPhone, instale o app na tela de início.',
  },
} as const;

/**
 * Liga o Web Push do navegador atual. É por dispositivo: a matriz de canais diz
 * quais tipos mandam push, e este cartão diz se este aparelho recebe.
 */
export function DevicePushCard() {
  const push = usePush();
  const copy = COPY[push.state];
  const actionable = push.state === 'on' || push.state === 'off';

  return (
    <SettingsCard
      title="Este dispositivo"
      description="O push vale só no navegador em que foi ligado."
    >
      <SettingsRow
        last
        title={
          <span className="flex items-center gap-2">
            {push.state === 'on' ? (
              <BellRing aria-hidden className="size-4 text-signal" />
            ) : (
              <BellOff aria-hidden className="size-4 text-muted" />
            )}
            {copy.title}
          </span>
        }
        description={copy.description}
        control={
          actionable ? (
            <Button
              variant={push.state === 'on' ? 'outline' : 'signal'}
              disabled={push.busy}
              onClick={() => {
                void (push.state === 'on' ? push.disable() : push.enable());
              }}
            >
              {push.state === 'on' ? 'Desligar' : 'Ligar notificações'}
            </Button>
          ) : null
        }
      />
    </SettingsCard>
  );
}
