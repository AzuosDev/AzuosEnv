import { createFileRoute } from '@tanstack/react-router';
import { CustomFieldsPanel } from '@/features/admin/components/custom-fields-panel';
import { PanelSkeleton } from '@/features/settings/components/panel-skeleton';
import { ensureAdmin } from '@/features/settings/guards';

function Page() {
  const { wsId } = Route.useParams();

  return <CustomFieldsPanel wsId={wsId} />;
}

export const Route = createFileRoute('/_app/w/$wsId/configuracoes/campos')({
  beforeLoad: ({ context, params }) => ensureAdmin(context.queryClient, params.wsId),
  component: Page,
  pendingComponent: PanelSkeleton,
});
