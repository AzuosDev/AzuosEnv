import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { membersQuery, teamsQuery, workspaceQuery } from '@/features/settings/api';
import { PanelSkeleton } from '@/features/settings/components/panel-skeleton';
import { TeamsPanel } from '@/features/settings/components/teams-panel';

function Page() {
  const { wsId } = Route.useParams();
  const { data: detail } = useSuspenseQuery(workspaceQuery(wsId));

  return <TeamsPanel wsId={wsId} role={detail.role} />;
}

export const Route = createFileRoute('/_app/w/$wsId/configuracoes/equipes')({
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(teamsQuery(params.wsId)),
      context.queryClient.ensureQueryData(membersQuery(params.wsId)),
    ]);
  },
  component: Page,
  pendingComponent: PanelSkeleton,
});
