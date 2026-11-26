import { QueryClient } from '@tanstack/react-query';

/** QueryClient do app: 5 min de staleTime e uma única retentativa. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      // A API roda em serverless: cada requisição evitada é um cold start a
      // menos. 5 min de staleTime e 30 min de cache; o socket invalida o que
      // muda de verdade, então dado velho não fica na tela.
      queries: {
        staleTime: 5 * 60_000,
        gcTime: 30 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: 0 },
    },
  });
}
