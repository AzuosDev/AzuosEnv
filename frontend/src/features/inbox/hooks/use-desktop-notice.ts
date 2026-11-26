import { useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useRef } from 'react';
import { shouldShowDesktopNotice, type DesktopNotice } from '../desktop-notice';

/**
 * Aviso do sistema desenhado pela aba. O caminho normal é o Web Push, que
 * funciona com o app fechado; este é o reforço para o navegador que não tem
 * inscrição — sem suporte, sem chave no servidor ou com o registro bloqueado
 * pela rede. Só dispara com a janela fora de foco: em foco o toast basta.
 */
export function useDesktopNotice(wsId: string): (notice: DesktopNotice) => void {
  const navigate = useNavigate();
  const subscribed = useRef(false);

  useEffect(() => {
    let alive = true;

    if (!('serviceWorker' in navigator)) {
      return;
    }

    void navigator.serviceWorker
      .getRegistration()
      .then((registration) => registration?.pushManager.getSubscription())
      .then((subscription) => {
        if (alive) {
          subscribed.current = Boolean(subscription);
        }
      })
      .catch(() => undefined);

    return () => {
      alive = false;
    };
  }, []);

  return useCallback(
    (notice: DesktopNotice) => {
      if (!('Notification' in window)) {
        return;
      }

      const show = shouldShowDesktopNotice({
        permission: Notification.permission,
        pushSubscribed: subscribed.current,
        focused: document.hasFocus(),
      });

      if (!show) {
        return;
      }

      try {
        const system = new Notification(notice.title, {
          body: notice.body,
          icon: '/icons/icon-192.png',
          tag: notice.tag,
          lang: 'pt-BR',
        });

        system.onclick = () => {
          window.focus();
          system.close();
          void navigate({ to: '/w/$wsId/inbox', params: { wsId } });
        };
      } catch {
        // Navegador que só aceita aviso pelo Service Worker: o push cobre.
      }
    },
    [navigate, wsId],
  );
}
