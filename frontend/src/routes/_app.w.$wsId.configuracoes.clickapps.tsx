import { createFileRoute } from '@tanstack/react-router';
import { ClickAppsPanel } from '@/features/admin/components/clickapps-panel';
import { PanelSkeleton } from '@/features/settings/components/panel-skeleton';
import { ensureAdmin } from '@/features/settings/guards';

function Page() {
  const { wsId } = Route.useParams();

  return <ClickAppsPanel wsId={wsId} />;
}

export const Route = createFileRoute('/_app/w/$wsId/configuracoes/clickapps')({
  beforeLoad: ({ context, params }) => ensureAdmin(context.queryClient, params.wsId),
  component: Page,
  pendingComponent: PanelSkeleton,
});
