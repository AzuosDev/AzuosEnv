import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pwaOptions } from '../../pwa.config';

const root = resolve(__dirname, '../..');
const manifest = pwaOptions.manifest as unknown as {
  name: string;
  short_name: string;
  start_url: string;
  display: string;
  theme_color: string;
  background_color: string;
  icons: { src: string; sizes: string; type: string; purpose: string }[];
};
const workbox = pwaOptions.workbox as unknown as {
  navigateFallback: string;
  navigateFallbackDenylist: RegExp[];
  runtimeCaching: { urlPattern: (arg: { url: URL }) => boolean; options: { cacheName: string } }[];
};

describe('manifest do PWA', () => {
  it('é instalável: standalone, start_url e nome curto', () => {
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
    expect(manifest.short_name.length).toBeLessThanOrEqual(12);
  });

  it('usa as cores dos tokens do tema escuro', () => {
    // --paper 11 7 20 e --accent 167 139 250.
    expect(manifest.background_color).toBe('#0B0714');
    expect(manifest.theme_color).toBe('#A78BFA');
  });

  it('tem os ícones 192, 512 e maskable, e os arquivos existem', () => {
    const sizes = manifest.icons.map((icon) => `${icon.sizes}:${icon.purpose}`);

    expect(sizes).toContain('192x192:any');
    expect(sizes).toContain('512x512:any');
    expect(sizes).toContain('512x512:maskable');

    for (const icon of manifest.icons) {
      expect(existsSync(resolve(root, 'public', icon.src.replace(/^\//, ''))), icon.src).toBe(true);
    }
  });

  it('o ícone é o </> em SVG', () => {
    const svg = readFileSync(resolve(root, 'public/icons/icon.svg'), 'utf8');

    // Dois chevrons e a barra: o desenho do </>.
    expect(svg.match(/<path /g)?.length).toBe(3);
    expect(svg).toContain('#A78BFA');
  });
});

describe('Service Worker', () => {
  it('cai no shell em navegação, menos em /api', () => {
    expect(workbox.navigateFallback).toBe('/index.html');
    expect(workbox.navigateFallbackDenylist.some((rule) => rule.test('/api/v1/tasks'))).toBe(true);
  });

  it('nunca cacheia resposta da API: só as fontes do Google têm runtime cache', () => {
    const cached = workbox.runtimeCaching.map((rule) => rule.options.cacheName);

    expect(cached).toEqual(['google-fonts-css', 'google-fonts-files']);

    for (const rule of workbox.runtimeCaching) {
      expect(rule.urlPattern({ url: new URL('https://api.azuosdev.com.br/api/v1/tasks') })).toBe(
        false,
      );
      expect(rule.urlPattern({ url: new URL('http://localhost:3000/api/v1/me') })).toBe(false);
    }
  });

  it('tem página offline amigável em português', () => {
    const page = readFileSync(resolve(root, 'public/offline.html'), 'utf8');

    expect(page).toContain('Você está sem conexão');
    expect(page).toContain('Tentar de novo');
    expect(pwaOptions.includeAssets).toContain('offline.html');
  });
});
