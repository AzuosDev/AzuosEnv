import { redirect } from '@tanstack/react-router';
import type { Workspace } from '@/api/types';

/** Caminho interno seguro vindo de ?next=; descarta URL absoluta. */
export function safeNext(next: string | undefined): '/' {
  if (next && next.startsWith('/') && !next.startsWith('//')) {
    return next as '/';
  }

  return '/';
}

/**
 * Para onde vai quem já está autenticado: sem workspace, onboarding; com um,
 * direto para ele; com vários, o seletor.
 */
export function workspaceRedirect(workspaces: Workspace[]): never {
  const first = workspaces[0];

  if (!first) {
    throw redirect({ to: '/onboarding' });
  }

  if (workspaces.length === 1) {
    throw redirect({ to: '/w/$wsId', params: { wsId: first.id } });
  }

  throw redirect({ to: '/workspaces' });
}
