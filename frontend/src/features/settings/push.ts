/** Estados possíveis do push neste navegador, na ordem em que a tela decide. */
export type PushState =
  'unsupported' | 'unconfigured' | 'blocked' | 'checking' | 'local' | 'off' | 'on';

export interface PushStateInput {
  /** O navegador tem Service Worker, PushManager e Notification. */
  supported: boolean;
  /** O servidor devolveu chave VAPID. */
  configured: boolean;
  permission: NotificationPermission;
  /** A busca pela inscrição deste navegador terminou. */
  checked: boolean;
  subscribed: boolean;
}

/**
 * Sem suporte ou sem chave no servidor a opção nem aparece; permissão negada
 * só o próprio navegador reverte, então o estado é separado de "desligado".
 * Com permissão dada e sem inscrição o canal é `local`: o aviso do sistema sai
 * da própria aba e só existe com o app aberto.
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

  if (!input.checked) {
    return 'checking';
  }

  if (input.subscribed) {
    return 'on';
  }

  return input.permission === 'granted' ? 'local' : 'off';
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

/** O navegador sabe desenhar aviso do sistema, com ou sem Web Push. */
export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** A permissão de hoje, sem quebrar onde a API não existe. */
export function currentPermission(): NotificationPermission {
  return notificationsSupported() ? Notification.permission : 'denied';
}

/**
 * O convite ao entrar só aparece enquanto o navegador não decidiu nada e o
 * usuário não adiou: permissão pedida sem contexto é permissão negada.
 */
export function shouldAskForPush(input: {
  supported: boolean;
  permission: NotificationPermission;
  snoozed: boolean;
}): boolean {
  return input.supported && input.permission === 'default' && !input.snoozed;
}

/**
 * A chave VAPID vem em base64url e o `pushManager.subscribe` só aceita bytes.
 */
export function vapidKeyToBytes(key: string): Uint8Array<ArrayBuffer> {
  const clean = key.trim();
  const padded = clean.padEnd(clean.length + ((4 - (clean.length % 4)) % 4), '=');
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

/**
 * Chave VAPID é um ponto P-256 sem compressão: 65 bytes começando em 0x04.
 * Chave fora disso faz o navegador devolver erro cru do serviço de push, então
 * é melhor barrar antes e dizer o que arrumar no servidor.
 */
export function isValidVapidKey(key: string): boolean {
  if (key.trim() === '') {
    return false;
  }

  try {
    const bytes = vapidKeyToBytes(key);

    return bytes.length === 65 && bytes[0] === 4;
  } catch {
    return false;
  }
}

/**
 * O navegador fala em inglês e sem contexto ("Registration failed - push
 * service error"). Aqui cada falha conhecida vira o que a pessoa pode fazer;
 * o resto volta como `null` para a mensagem padrão da API valer.
 */
export function pushErrorMessage(error: unknown): string | null {
  const raw = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const text = raw.toLowerCase();

  if (text.includes('push service error') || text.includes('registration failed')) {
    return 'O navegador não conseguiu registrar no serviço de push (bloqueio de rede, proxy ou política do Chrome). Os avisos ainda aparecem com o Azuos Env aberto.';
  }

  if (text.includes('permission') || text.includes('notallowed')) {
    return 'O navegador bloqueou o aviso para este site. Libere nas permissões do site e tente de novo.';
  }

  if (text.includes('applicationserverkey') || text.includes('invalidaccess')) {
    return 'A chave de push do servidor é inválida (VAPID_PUBLIC_KEY). Avise o administrador.';
  }

  return null;
}
