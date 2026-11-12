import type { VitePWAOptions } from 'vite-plugin-pwa';

/**
 * PWA do Azuos Env. Fica fora do vite.config para o teste conferir o manifest,
 * os ícones e a regra que mantém a API fora do cache.
 */
export const pwaOptions: Partial<VitePWAOptions> = {
  registerType: 'autoUpdate',
  // Em dev o Service Worker fica fora do caminho (o e2e roda no dev server).
  devOptions: { enabled: false },
  includeAssets: ['favicon.svg', 'offline.html', 'icons/*.png', 'icons/icon.svg'],
  manifest: {
    name: 'Azuos Env',
    short_name: 'Azuos Env',
    description: 'O sistema da Azuos Dev para tarefas, docs, metas e tempo.',
    lang: 'pt-BR',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    // Tokens do tema escuro: --paper e --accent.
    background_color: '#0B0714',
    theme_color: '#A78BFA',
    categories: ['productivity', 'business'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  },
  workbox: {
    // Shell e assets do build entram no precache.
    globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
    maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
    navigateFallback: '/index.html',
    // Nada da API passa pelo Service Worker: resposta de dados nunca é cacheada.
    navigateFallbackDenylist: [/^\/api\//],
    navigationPreload: false,
    cleanupOutdatedCaches: true,
    clientsClaim: true,
    skipWaiting: true,
    runtimeCaching: [
      {
        // Só a fonte do Google: o CSS revalida e o arquivo da fonte fica.
        urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
        handler: 'StaleWhileRevalidate',
        options: { cacheName: 'google-fonts-css' },
      },
      {
        urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts-files',
          expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
    ],
  },
};
