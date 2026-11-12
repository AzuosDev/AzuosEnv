import { QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'react-grid-layout/css/styles.css';
import { onSessionLost, setAccessToken } from '@/api/token-store';
import { setSession } from '@/features/auth/session';
import { RouteError } from '@/components/route-error';
import { registerPwa } from '@/lib/pwa';
import { createQueryClient } from '@/lib/query-client';
import { routeTree } from './routeTree.gen';
import './styles/globals.css';

const queryClient = createQueryClient();

const router = createRouter({
  routeTree,
  context: { queryClient },
  // Preload no hover/foco do link: a rota chega antes do clique.
  defaultPreload: 'intent',
  defaultPreloadDelay: 50,
  // Toda rota ganha o mesmo error boundary, com "Tentar de novo".
  defaultErrorComponent: ({ error, reset }) => <RouteError error={error} reset={reset} />,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

/** Sessão perdida (refresh falhou): limpa tudo e volta para o login. */
onSessionLost(() => {
  setAccessToken(null);
  queryClient.clear();
  setSession(queryClient, null);
  void router.navigate({
    to: '/login',
    search: { next: router.state.location.href, expirado: true },
    replace: true,
  });
});

const container = document.getElementById('root');

if (!container) {
  throw new Error('Elemento #root não encontrado.');
}

void registerPwa();

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
