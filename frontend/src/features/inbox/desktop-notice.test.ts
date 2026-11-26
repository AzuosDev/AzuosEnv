import { describe, expect, it } from 'vitest';
import { shouldShowDesktopNotice } from './desktop-notice';

const base = {
  permission: 'granted' as NotificationPermission,
  pushSubscribed: false,
  focused: false,
};

describe('shouldShowDesktopNotice', () => {
  it('avisa quando a permissão existe, o push não cobre e a janela está fora de foco', () => {
    expect(shouldShowDesktopNotice(base)).toBe(true);
  });

  it('cala com a janela em foco: o toast já conta', () => {
    expect(shouldShowDesktopNotice({ ...base, focused: true })).toBe(false);
  });

  it('cala quando o Web Push já vai desenhar o aviso', () => {
    expect(shouldShowDesktopNotice({ ...base, pushSubscribed: true })).toBe(false);
  });

  it('cala sem permissão', () => {
    expect(shouldShowDesktopNotice({ ...base, permission: 'default' })).toBe(false);
    expect(shouldShowDesktopNotice({ ...base, permission: 'denied' })).toBe(false);
  });
});
