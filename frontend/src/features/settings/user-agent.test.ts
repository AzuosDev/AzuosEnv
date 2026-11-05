import { describe, expect, it } from 'vitest';
import { deviceLabel } from './user-agent';

describe('deviceLabel', () => {
  it('junta navegador e sistema', () => {
    expect(
      deviceLabel(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36',
      ),
    ).toBe('Chrome no Windows');
  });

  it('reconhece o Edge antes do Chrome', () => {
    expect(deviceLabel('Mozilla/5.0 (Windows NT 10.0) Chrome/141.0 Safari/537.36 Edg/141.0')).toBe(
      'Edge no Windows',
    );
  });

  it('reconhece o Safari do iPhone', () => {
    expect(
      deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Safari/604'),
    ).toBe('Safari no iOS');
  });

  it('cai no texto genérico sem user agent', () => {
    expect(deviceLabel()).toBe('Dispositivo desconhecido');
    expect(deviceLabel('   ')).toBe('Dispositivo desconhecido');
    expect(deviceLabel('curl/8.0')).toBe('Dispositivo desconhecido');
  });
});
