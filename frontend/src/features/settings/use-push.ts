import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '@/api/errors';
import { toast } from '@/components/ui/toast';
import { pushPublicKeyQuery, subscribeToPush, unsubscribeFromPush } from './api';
import {
  currentPermission,
  isValidVapidKey,
  notificationsSupported,
  pushErrorMessage,
  pushState,
  pushSupported,
  vapidKeyToBytes,
  type PushState,
} from './push';

export interface PushDevice {
  state: PushState;
  permission: NotificationPermission;
  /** Uma chamada em andamento: a tela trava o botão. */
  busy: boolean;
  /** Pede a permissão e, se der, inscreve este navegador no Web Push. */
  enable: () => Promise<void>;
  disable: () => Promise<void>;
}

/** O Service Worker deste site, já ativo. Em dev não existe e devolve null. */
async function activeRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    return null;
  }

  const existing = await navigator.serviceWorker.getRegistration();

  if (!existing) {
    return null;
  }

  // Só o `ready` garante worker ativo, e com registro na mão ele resolve.
  return navigator.serviceWorker.ready;
}

/** A inscrição guardada nasceu com outra chave VAPID: o servidor trocou de par. */
function keyChanged(subscription: PushSubscription, key: Uint8Array): boolean {
  const current = subscription.options.applicationServerKey;

  if (!current) {
    return true;
  }

  const bytes = new Uint8Array(current);

  return bytes.length !== key.length || bytes.some((byte, index) => byte !== key[index]);
}

/**
 * Push deste navegador. O Service Worker só existe no build de produção; sem
 * ele a permissão ainda é pedida e o aviso do sistema sai da própria aba
 * enquanto o app está aberto (estado `local`).
 */
export function usePush(): PushDevice {
  const supported = pushSupported();
  const { data: publicKey = '' } = useQuery({ ...pushPublicKeyQuery, enabled: supported });
  const [permission, setPermission] = useState<NotificationPermission>(currentPermission);
  const [subscribed, setSubscribed] = useState(false);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supported) {
      return;
    }

    let alive = true;

    void activeRegistration()
      .then((registration) => registration?.pushManager.getSubscription() ?? null)
      .catch(() => null)
      .then((subscription) => {
        if (alive) {
          setSubscribed(subscription !== null);
          setChecked(true);
        }
      });

    return () => {
      alive = false;
    };
  }, [supported]);

  const enable = useCallback(async () => {
    if (!notificationsSupported()) {
      return;
    }

    setBusy(true);

    try {
      const granted = await Notification.requestPermission();

      setPermission(granted);

      if (granted !== 'granted') {
        return;
      }

      const registration = supported ? await activeRegistration() : null;

      // Sem Service Worker ou sem chave no servidor só dá para avisar com o
      // app aberto — e é o que a pessoa acabou de autorizar.
      if (!registration || publicKey === '') {
        setChecked(true);
        toast.success('Avisos do sistema liberados neste navegador.');

        return;
      }

      if (!isValidVapidKey(publicKey)) {
        toast.error('A chave de push do servidor é inválida (VAPID_PUBLIC_KEY).');

        return;
      }

      const key = vapidKeyToBytes(publicKey);
      const current = await registration.pushManager.getSubscription();

      // Inscrição antiga de outra chave faz o navegador recusar a nova.
      if (current && keyChanged(current, key)) {
        await current.unsubscribe();
      }

      const subscription =
        current && !keyChanged(current, key)
          ? current
          : await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: key,
            });
      const json = subscription.toJSON();

      await subscribeToPush({
        endpoint: subscription.endpoint,
        keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
        userAgent: navigator.userAgent.slice(0, 255),
      });

      setSubscribed(true);
      setChecked(true);
      toast.success('Notificações ligadas neste dispositivo.');
    } catch (error) {
      setChecked(true);
      toast.error(pushErrorMessage(error) ?? errorMessage(error));
    } finally {
      setBusy(false);
    }
  }, [publicKey, supported]);

  const disable = useCallback(async () => {
    setBusy(true);

    try {
      const registration = await activeRegistration();
      const subscription = (await registration?.pushManager.getSubscription()) ?? null;

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
    state: pushState({ supported, configured: publicKey !== '', permission, checked, subscribed }),
    permission,
    busy,
    enable,
    disable,
  };
}
