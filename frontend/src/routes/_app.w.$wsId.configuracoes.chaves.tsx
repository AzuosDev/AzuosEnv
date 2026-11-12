import { createFileRoute } from '@tanstack/react-router';
import { ApiKeysPanel } from '@/features/admin/components/api-keys-panel';
import { PanelSkeleton } from '@/features/settings/components/panel-skeleton';
import { ensureAdmin } from '@/features/settings/guards';

function Page() {
  return <ApiKeysPanel />;
}

export const Route = createFileRoute('/_app/w/$wsId/configuracoes/chaves')({
  beforeLoad: ({ context, params }) => ensureAdmin(context.queryClient, params.wsId),
  component: Page,
  pendingComponent: PanelSkeleton,
});
