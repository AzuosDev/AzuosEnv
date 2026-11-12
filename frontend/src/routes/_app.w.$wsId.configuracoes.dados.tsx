import { createFileRoute } from '@tanstack/react-router';
import { DataPanel } from '@/features/admin/components/data-panel';
import { PanelSkeleton } from '@/features/settings/components/panel-skeleton';
import { ensureAdmin } from '@/features/settings/guards';

function Page() {
  const { wsId } = Route.useParams();

  return <DataPanel wsId={wsId} />;
}

export const Route = createFileRoute('/_app/w/$wsId/configuracoes/dados')({
  beforeLoad: ({ context, params }) => ensureAdmin(context.queryClient, params.wsId),
  component: Page,
  pendingComponent: PanelSkeleton,
});
