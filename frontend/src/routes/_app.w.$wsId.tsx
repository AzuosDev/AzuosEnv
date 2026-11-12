import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import type { Workspace } from '@/api/types';
import { useSession } from '@/features/auth/session';
import { HierarchyProvider } from '@/features/hierarchy/components/hierarchy-provider';
import { useTitleBadge } from '@/features/inbox/hooks/use-title-badge';
import { SocketProvider } from '@/features/realtime/socket';
import { useWorkspaceRealtime } from '@/features/realtime/use-workspace-realtime';
import { AppShell } from '@/features/shell/components/app-shell';
import { workspacesQuery } from '@/features/workspaces/api';

/**
 * Tempo real e badge ficam dentro do SocketProvider: o hook do socket precisa
 * do contexto, e o título da aba segue a contagem do Inbox.
 */
function WorkspaceBody({ wsId, workspaces }: { wsId: string; workspaces: Workspace[] }) {
  const user = useSession();

  useWorkspaceRealtime({ wsId, currentUserId: user?.id });
  useTitleBadge(wsId);

  return (
    <HierarchyProvider wsId={wsId}>
      <AppShell wsId={wsId} workspaces={workspaces}>
        <Outlet />
      </AppShell>
    </HierarchyProvider>
  );
}

function WorkspaceLayout() {
  const { wsId } = Route.useParams();
  const { data: workspaces } = useSuspenseQuery(workspacesQuery);

  return (
    <SocketProvider wsId={wsId}>
      <WorkspaceBody wsId={wsId} workspaces={workspaces} />
    </SocketProvider>
  );
}

export const Route = createFileRoute('/_app/w/$wsId')({
  loader: async ({ context, params }) => {
    const workspaces = await context.queryClient.ensureQueryData(workspacesQuery);

    if (workspaces.some((workspace) => workspace.id === params.wsId)) {
      return;
    }

    if (workspaces.length === 0) {
      throw redirect({ to: '/onboarding', replace: true });
    }

    throw redirect({ to: '/workspaces', replace: true });
  },
  component: WorkspaceLayout,
});
