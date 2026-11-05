import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { workspaceQuery } from '@/features/settings/api';
import { WorkspaceForm } from '@/features/settings/components/workspace-form';
import { ensureAdmin } from '@/features/settings/guards';

function Page() {
  const { wsId } = Route.useParams();
  const { data: detail } = useSuspenseQuery(workspaceQuery(wsId));

  return <WorkspaceForm wsId={wsId} workspace={detail.workspace} />;
}

export const Route = createFileRoute('/_app/w/$wsId/configuracoes/workspace')({
  beforeLoad: ({ context, params }) => ensureAdmin(context.queryClient, params.wsId),
  component: Page,
});
