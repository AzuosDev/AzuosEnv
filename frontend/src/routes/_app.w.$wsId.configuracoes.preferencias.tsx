import { createFileRoute } from '@tanstack/react-router';
import { useSession } from '@/features/auth/session';
import { PreferencesForm } from '@/features/settings/components/preferences-form';

function Page() {
  const user = useSession();

  return user ? <PreferencesForm user={user} /> : null;
}

export const Route = createFileRoute('/_app/w/$wsId/configuracoes/preferencias')({
  component: Page,
});
