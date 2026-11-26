import { describe, expect, it } from 'vitest';
import {
  isValidVapidKey,
  pushErrorMessage,
  pushState,
  shouldAskForPush,
  vapidKeyToBytes,
} from './push';

const base = {
  supported: true,
  configured: true,
  permission: 'default' as NotificationPermission,
  checked: true,
  subscribed: false,
};

describe('pushState', () => {
  it('esconde a opção sem suporte do navegador ou sem chave no servidor', () => {
    expect(pushState({ ...base, supported: false })).toBe('unsupported');
    expect(pushState({ ...base, configured: false })).toBe('unconfigured');
  });

  it('separa bloqueado no navegador de apenas desligado', () => {
    expect(pushState({ ...base, permission: 'denied' })).toBe('blocked');
    expect(pushState(base)).toBe('off');
  });

  it('espera a busca da inscrição antes de dizer o estado', () => {
    expect(pushState({ ...base, checked: false })).toBe('checking');
    expect(pushState({ ...base, checked: false, permission: 'denied' })).toBe('blocked');
  });

  it('permissão dada sem inscrição é aviso só com o app aberto', () => {
    expect(pushState({ ...base, permission: 'granted' })).toBe('local');
    expect(pushState({ ...base, permission: 'granted', subscribed: true })).toBe('on');
  });

  it('sem suporte vence a permissão negada', () => {
    expect(pushState({ ...base, supported: false, permission: 'denied' })).toBe('unsupported');
  });
});

describe('shouldAskForPush', () => {
  const ask = { supported: true, permission: 'default' as NotificationPermission, snoozed: false };

  it('convida só quando o navegador ainda não decidiu', () => {
    expect(shouldAskForPush(ask)).toBe(true);
    expect(shouldAskForPush({ ...ask, permission: 'granted' })).toBe(false);
    expect(shouldAskForPush({ ...ask, permission: 'denied' })).toBe(false);
  });

  it('respeita o adiamento e a falta de suporte', () => {
    expect(shouldAskForPush({ ...ask, snoozed: true })).toBe(false);
    expect(shouldAskForPush({ ...ask, supported: false })).toBe(false);
  });
});

describe('vapidKeyToBytes', () => {
  it('decodifica base64url com e sem preenchimento', () => {
    // "Azuos" em base64 é QXp1b3M=; o servidor manda sem o = e com -/_.
    expect(Array.from(vapidKeyToBytes('QXp1b3M'))).toEqual([65, 122, 117, 111, 115]);
    expect(Array.from(vapidKeyToBytes('QXp1b3M='))).toEqual([65, 122, 117, 111, 115]);
  });

  it('traduz - e _ para + e /', () => {
    const bytes = vapidKeyToBytes('-_8=');

    expect(Array.from(bytes)).toEqual([251, 255]);
  });
});

describe('isValidVapidKey', () => {
  /** Ponto P-256 sem compressão: 0x04 e mais 64 bytes. */
  const key = btoa(String.fromCharCode(4, ...new Array<number>(64).fill(7)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  it('aceita a chave de 65 bytes começando em 0x04', () => {
    expect(isValidVapidKey(key)).toBe(true);
    expect(isValidVapidKey(`${key}\n`)).toBe(true);
  });

  it('recusa chave vazia, curta ou fora do formato', () => {
    expect(isValidVapidKey('')).toBe(false);
    expect(isValidVapidKey('QXp1b3M')).toBe(false);
    expect(isValidVapidKey('não é base64 ###')).toBe(false);
  });
});

describe('pushErrorMessage', () => {
  it('traduz a falha de registro do navegador', () => {
    const message = pushErrorMessage(new Error('Registration failed - push service error'));

    expect(message).toContain('serviço de push');
  });

  it('aponta a chave do servidor quando ela é recusada', () => {
    const message = pushErrorMessage(
      new Error('applicationServerKey must contain a valid P-256 public key'),
    );

    expect(message).toContain('VAPID_PUBLIC_KEY');
  });

  it('devolve null no erro que não conhece', () => {
    expect(pushErrorMessage(new Error('qualquer outra coisa'))).toBeNull();
  });
});
