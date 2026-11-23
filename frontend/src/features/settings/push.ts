/** Estados possíveis do push neste navegador, na ordem em que a tela decide. */
export type PushState = 'unsupported' | 'unconfigured' | 'blocked' | 'off' | 'on';

export interface PushStateInput {
  /** O navegador tem Service Worker, PushManager e Notification. */
  supported: boolean;
  /** O servidor devolveu chave VAPID. */
  configured: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
}

/**
 * Sem suporte ou sem chave no servidor a opção nem aparece; permissão negada
 * só o próprio navegador reverte, então o estado é separado de "desligado".
 */
export function pushState(input: PushStateInput): PushState {
  if (!input.supported) {
    return 'unsupported';
  }

  if (!input.configured) {
    return 'unconfigured';
  }

  if (input.permission === 'denied') {
    return 'blocked';
  }

  return input.subscribed ? 'on' : 'off';
}

/** O navegador tem tudo que o Web Push exige. */
export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * A chave VAPID vem em base64url e o `pushManager.subscribe` só aceita bytes.
 */
export function vapidKeyToBytes(key: string): Uint8Array<ArrayBuffer> {
  const padded = key.padEnd(key.length + ((4 - (key.length % 4)) % 4), '=');
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}
