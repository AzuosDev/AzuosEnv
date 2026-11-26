import { Bell, BellOff, BellRing } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '@/api/errors';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { sendPushTest } from '../api';
import { usePush } from '../use-push';
import { SettingsCard, SettingsRow } from './settings-card';

/** O que cada estado do push diz e oferece neste navegador. */
const COPY = {
  on: {
    title: 'Notificações ligadas neste dispositivo',
    description: 'Os avisos com o canal Push marcado chegam mesmo com o app fechado.',
  },
  checking: {
    title: 'Verificando este dispositivo',
    description: 'Um instante enquanto o navegador responde.',
  },
  local: {
    title: 'Avisos do sistema só com o app aberto',
    description:
      'O navegador liberou o aviso, mas não se inscreveu no serviço de push — rede, proxy ou política do navegador costumam ser a causa. Com o Azuos Env aberto o aviso aparece na área de trabalho.',
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
  const [testing, setTesting] = useState(false);

  /**
   * Aviso de teste pelo caminho real (servidor → serviço de push → navegador).
   * O resultado por dispositivo evita o beco sem saída de "liguei e não chega":
   * a falha aparece aqui, com o status que o serviço de push devolveu.
   */
  const test = async (): Promise<void> => {
    setTesting(true);

    try {
      const { configured, results } = await sendPushTest();

      if (!configured) {
        toast.error('O servidor não tem chaves VAPID configuradas.');

        return;
      }

      if (results.length === 0) {
        toast.error('Nenhum dispositivo inscrito nesta conta.');

        return;
      }

      const failure = results.find((result) => !result.ok);

      if (!failure) {
        toast.success(
          results.length === 1
            ? 'Aviso de teste enviado. Ele deve aparecer na área de trabalho em instantes.'
            : `Aviso de teste enviado para ${results.length} dispositivos.`,
        );

        return;
      }

      toast.error(
        `${failure.host} recusou (${failure.statusCode ?? 'sem status'}): ${failure.message}`,
      );
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setTesting(false);
    }
  };
  const copy = COPY[push.state];
  const actionable = push.state === 'on' || push.state === 'off' || push.state === 'local';
  const label =
    push.state === 'on'
      ? 'Desligar'
      : push.state === 'local'
        ? 'Tentar de novo'
        : 'Ligar notificações';

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
            ) : push.state === 'local' ? (
              <Bell aria-hidden className="size-4 text-accent" />
            ) : (
              <BellOff aria-hidden className="size-4 text-muted" />
            )}
            {copy.title}
          </span>
        }
        description={copy.description}
        control={
          actionable ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              {push.state === 'on' ? (
                <Button variant="ghost" disabled={testing} onClick={() => void test()}>
                  {testing ? 'Enviando…' : 'Enviar teste'}
                </Button>
              ) : null}
              <Button
                variant={push.state === 'on' ? 'outline' : 'signal'}
                disabled={push.busy}
                onClick={() => {
                  void (push.state === 'on' ? push.disable() : push.enable());
                }}
              >
                {label}
              </Button>
            </div>
          ) : null
        }
      />
    </SettingsCard>
  );
}
