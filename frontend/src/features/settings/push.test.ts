import { describe, expect, it } from 'vitest';
import { pushState, vapidKeyToBytes } from './push';

const base = {
  supported: true,
  configured: true,
  permission: 'default' as NotificationPermission,
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

  it('ligado exige permissão e inscrição', () => {
    expect(pushState({ ...base, permission: 'granted' })).toBe('off');
    expect(pushState({ ...base, permission: 'granted', subscribed: true })).toBe('on');
  });

  it('sem suporte vence a permissão negada', () => {
    expect(pushState({ ...base, supported: false, permission: 'denied' })).toBe('unsupported');
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
