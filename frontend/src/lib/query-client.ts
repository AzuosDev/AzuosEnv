import { QueryClient } from '@tanstack/react-query';

/** QueryClient do app: 30 s de staleTime e uma única retentativa. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
      mutations: { retry: 0 },
    },
  });
}
