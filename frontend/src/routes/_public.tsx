import { createFileRoute, Outlet } from '@tanstack/react-router';
import { workspaceRedirect } from '@/features/auth/navigation';
import { ensureSession } from '@/features/auth/session';
import { workspacesQuery } from '@/features/workspaces/api';

/** Grupo público: quem já tem sessão não vê login nem cadastro. */
export const Route = createFileRoute('/_public')({
  beforeLoad: async ({ context }) => {
    const user = await ensureSession(context.queryClient);

    if (user) {
      workspaceRedirect(await context.queryClient.ensureQueryData(workspacesQuery));
    }
  },
  component: Outlet,
});
