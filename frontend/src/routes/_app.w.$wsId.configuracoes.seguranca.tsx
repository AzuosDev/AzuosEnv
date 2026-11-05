import { createFileRoute } from '@tanstack/react-router';
import { sessionsQuery } from '@/features/settings/api';
import { PanelSkeleton } from '@/features/settings/components/panel-skeleton';
import { PasswordForm } from '@/features/settings/components/password-form';
import { SessionsPanel } from '@/features/settings/components/sessions-panel';

function Page() {
  return (
    <>
      <PasswordForm />
      <SessionsPanel />
    </>
  );
}

export const Route = createFileRoute('/_app/w/$wsId/configuracoes/seguranca')({
  loader: ({ context }) => context.queryClient.ensureQueryData(sessionsQuery),
  component: Page,
  pendingComponent: PanelSkeleton,
});
