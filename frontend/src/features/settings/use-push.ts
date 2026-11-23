import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '@/api/errors';
import { toast } from '@/components/ui/toast';
import { pushPublicKeyQuery, subscribeToPush, unsubscribeFromPush } from './api';
import { pushState, pushSupported, vapidKeyToBytes, type PushState } from './push';

export interface PushDevice {
  state: PushState;
  /** Uma chamada em andamento: a tela trava o botão. */
  busy: boolean;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
}

/**
 * Push deste navegador. O Service Worker só existe no build de produção, então
 * em desenvolvimento o estado fica `unsupported` e a tela explica isso.
 */
export function usePush(): PushDevice {
  const supported = pushSupported();
  const { data: publicKey = '' } = useQuery({ ...pushPublicKeyQuery, enabled: supported });
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    supported ? Notification.permission : 'denied',
  );
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supported) {
      return;
    }

    let alive = true;

    void navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        if (alive) {
          setSubscribed(subscription !== null);
        }
      })
      .catch(() => undefined);

    return () => {
      alive = false;
    };
  }, [supported]);

  const enable = useCallback(async () => {
    setBusy(true);

    try {
      const granted = await Notification.requestPermission();

      setPermission(granted);

      if (granted !== 'granted') {
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKeyToBytes(publicKey),
        }));
      const json = subscription.toJSON();

      await subscribeToPush({
        endpoint: subscription.endpoint,
        keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
        userAgent: navigator.userAgent.slice(0, 255),
      });

      setSubscribed(true);
      toast.success('Notificações ligadas neste dispositivo.');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }, [publicKey]);

  const disable = useCallback(async () => {
    setBusy(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // O servidor primeiro: sem a inscrição local o endpoint se perde.
        await unsubscribeFromPush(subscription.endpoint);
        await subscription.unsubscribe();
      }

      setSubscribed(false);
      toast.success('Notificações desligadas neste dispositivo.');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    state: pushState({ supported, configured: publicKey !== '', permission, subscribed }),
    busy,
    enable,
    disable,
  };
}
