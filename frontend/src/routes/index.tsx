import { createFileRoute, redirect } from '@tanstack/react-router';
import { workspaceRedirect } from '@/features/auth/navigation';
import { ensureSession } from '@/features/auth/session';
import { workspacesQuery } from '@/features/workspaces/api';

/** Entrada do app: manda para o login ou para o workspace certo. */
export const Route = createFileRoute('/')({
  beforeLoad: async ({ context }) => {
    const user = await ensureSession(context.queryClient);

    if (!user) {
      throw redirect({ to: '/login', replace: true });
    }

    workspaceRedirect(await context.queryClient.ensureQueryData(workspacesQuery));
  },
  component: () => null,
});
