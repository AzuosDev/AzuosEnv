import { describe, expect, it } from 'vitest';
import { API_BASE_URL } from '@/api/client';
import { googleLoginUrl } from './api';

describe('googleLoginUrl', () => {
  it('aponta para o início do OAuth na API, sem parâmetros à toa', () => {
    expect(googleLoginUrl()).toBe(`${API_BASE_URL}/api/v1/auth/google`);
    expect(googleLoginUrl({ next: '/' })).toBe(`${API_BASE_URL}/api/v1/auth/google`);
  });

  it('leva o destino interno e o convite', () => {
    const url = new URL(googleLoginUrl({ next: '/w/abc/inbox', invite: 'tok-123' }));

    expect(url.searchParams.get('next')).toBe('/w/abc/inbox');
    expect(url.searchParams.get('invite')).toBe('tok-123');
  });

  it('descarta destino externo', () => {
    expect(new URL(googleLoginUrl({ next: 'https://evil.test/x' })).searchParams.has('next')).toBe(
      false,
    );
    expect(new URL(googleLoginUrl({ next: '//evil.test' })).searchParams.has('next')).toBe(false);
  });
});
