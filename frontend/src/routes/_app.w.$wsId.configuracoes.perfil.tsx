import { createFileRoute } from '@tanstack/react-router';
import { useSession } from '@/features/auth/session';
import { ProfileForm } from '@/features/settings/components/profile-form';

function Page() {
  const user = useSession();

  return user ? <ProfileForm user={user} /> : null;
}

export const Route = createFileRoute('/_app/w/$wsId/configuracoes/perfil')({ component: Page });
