import { createFileRoute } from '@tanstack/react-router';
import { AuditPanel } from '@/features/admin/components/audit-panel';
import { membersQuery } from '@/features/settings/api';
import { PanelSkeleton } from '@/features/settings/components/panel-skeleton';
import { ensureAdmin } from '@/features/settings/guards';

function Page() {
  const { wsId } = Route.useParams();

  return <AuditPanel wsId={wsId} />;
}

export const Route = createFileRoute('/_app/w/$wsId/configuracoes/auditoria')({
  beforeLoad: ({ context, params }) => ensureAdmin(context.queryClient, params.wsId),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(membersQuery(params.wsId)),
  component: Page,
  pendingComponent: PanelSkeleton,
});
