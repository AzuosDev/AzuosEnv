import { QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { onSessionLost, setAccessToken } from '@/api/token-store';
import { setSession } from '@/features/auth/session';
import { createQueryClient } from '@/lib/query-client';
import { routeTree } from './routeTree.gen';
import './styles/globals.css';

const queryClient = createQueryClient();

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
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
    search: { next: router.state.location.href },
    replace: true,
  });
});

const container = document.getElementById('root');

if (!container) {
  throw new Error('Elemento #root não encontrado.');
}

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
