import { createFileRoute } from '@tanstack/react-router';
import { GithubCard } from '@/features/admin/components/github-card';
import { GoogleCard } from '@/features/admin/components/google-card';
import { PanelSkeleton } from '@/features/settings/components/panel-skeleton';
import { ensureAdmin } from '@/features/settings/guards';

function Page() {
  const { wsId } = Route.useParams();

  return (
    <>
      <GithubCard wsId={wsId} />
      <GoogleCard wsId={wsId} />
    </>
  );
}

export const Route = createFileRoute('/_app/w/$wsId/configuracoes/integracoes')({
  beforeLoad: ({ context, params }) => ensureAdmin(context.queryClient, params.wsId),
  component: Page,
  pendingComponent: PanelSkeleton,
});
