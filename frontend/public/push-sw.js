// Importado pelo Service Worker gerado (workbox.importScripts do pwa.config.ts).
// Web Push das notificacoes: o payload vem como JSON de PushService.PushPayload.
/* global self, clients, URL */

self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  let payload;

  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Azuos Env', body: event.data.text(), url: '/' };
  }

  const title = payload.title || 'Azuos Env';
  const url = payload.url || '/';

  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      // Aviso do mesmo assunto substitui o anterior em vez de empilhar.
      tag: payload.tag || undefined,
      data: { url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const target = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      // Ja existe aba do app: foca e navega nela em vez de abrir outra.
      for (const client of windows) {
        if (client.url.includes(new URL(target, client.url).pathname) && 'focus' in client) {
          return client.focus();
        }
      }

      const open = windows[0];

      if (open && 'navigate' in open) {
        return open.navigate(target).then((client) => (client ? client.focus() : undefined));
      }

      return clients.openWindow(target);
    }),
  );
});
