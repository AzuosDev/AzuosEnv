import { toast } from 'sonner';

/**
 * Service Worker do PWA: só no build (em dev o plugin fica desligado). Ele
 * guarda o shell e os assets — nunca resposta da API — e avisa quando há
 * versão nova.
 */
export async function registerPwa(): Promise<void> {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
    return;
  }

  const { registerSW } = await import('virtual:pwa-register');

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      toast('Nova versão do Azuos Env disponível.', {
        duration: Infinity,
        action: {
          label: 'Atualizar',
          onClick: () => {
            void updateSW(true);
          },
        },
      });
    },
    onOfflineReady() {
      toast.success('Pronto para usar sem conexão.');
    },
  });
}
