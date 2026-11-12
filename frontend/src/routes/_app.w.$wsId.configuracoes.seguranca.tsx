import { createFileRoute } from '@tanstack/react-router';
import { useSession } from '@/features/auth/session';
import { sessionsQuery } from '@/features/settings/api';
import { ConnectedAccounts } from '@/features/settings/components/connected-accounts';
import { PanelSkeleton } from '@/features/settings/components/panel-skeleton';
import { PasswordForm } from '@/features/settings/components/password-form';
import { SessionsPanel } from '@/features/settings/components/sessions-panel';
import { SetPasswordForm } from '@/features/settings/components/set-password-form';

function Page() {
  const user = useSession();
  // Conta criada pelo Google não tem senha: ali o cartão é "definir", não "trocar".
  const hasPassword = user?.authProviders.includes('password') ?? true;

  return (
    <>
      {hasPassword ? <PasswordForm /> : <SetPasswordForm />}
      <ConnectedAccounts />
      <SessionsPanel />
    </>
  );
}

export const Route = createFileRoute('/_app/w/$wsId/configuracoes/seguranca')({
  loader: ({ context }) => context.queryClient.ensureQueryData(sessionsQuery),
  component: Page,
  pendingComponent: PanelSkeleton,
});
