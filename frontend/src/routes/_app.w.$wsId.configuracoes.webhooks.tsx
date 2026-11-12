import { createFileRoute } from '@tanstack/react-router';
import { WebhooksPanel } from '@/features/admin/components/webhooks-panel';
import { PanelSkeleton } from '@/features/settings/components/panel-skeleton';
import { ensureAdmin } from '@/features/settings/guards';

function Page() {
  const { wsId } = Route.useParams();

  return <WebhooksPanel wsId={wsId} />;
}

export const Route = createFileRoute('/_app/w/$wsId/configuracoes/webhooks')({
  beforeLoad: ({ context, params }) => ensureAdmin(context.queryClient, params.wsId),
  component: Page,
  pendingComponent: PanelSkeleton,
});
