import type { QueryClient } from '@tanstack/react-query';
import { redirect } from '@tanstack/react-router';
import { workspaceQuery } from './api';
import { canAdmin } from './roles';

/**
 * Seções de admin: member, limited e guest nem veem a aba nem abrem a rota
 * direto pela URL.
 */
export async function ensureAdmin(queryClient: QueryClient, wsId: string): Promise<void> {
  const { role } = await queryClient.ensureQueryData(workspaceQuery(wsId));

  if (!canAdmin(role)) {
    throw redirect({ to: '/w/$wsId/configuracoes', params: { wsId }, replace: true });
  }
}
