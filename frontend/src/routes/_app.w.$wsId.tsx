import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { HierarchyProvider } from '@/features/hierarchy/components/hierarchy-provider';
import { SocketProvider } from '@/features/realtime/socket';
import { AppShell } from '@/features/shell/components/app-shell';
import { workspacesQuery } from '@/features/workspaces/api';

function WorkspaceLayout() {
  const { wsId } = Route.useParams();
  const { data: workspaces } = useSuspenseQuery(workspacesQuery);

  return (
    <SocketProvider wsId={wsId}>
      <HierarchyProvider wsId={wsId}>
        <AppShell wsId={wsId} workspaces={workspaces}>
          <Outlet />
        </AppShell>
      </HierarchyProvider>
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
