import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { ensureSession, useSession } from '@/features/auth/session';
import { RealtimeProvider } from '@/features/realtime/realtime';
import { useServerTheme } from '@/features/settings/hooks/use-server-theme';

function AppGroup() {
  const user = useSession();

  // O tema salvo na conta vence o localStorage a cada sessão restaurada.
  useServerTheme(user);

  // Uma conexão por aba, viva em qualquer tela: a sala do usuário traz
  // notificação e resumo do chat mesmo com o Chat fechado.
  return (
    <RealtimeProvider userId={user?.id}>
      <Outlet />
    </RealtimeProvider>
  );
}

/** Grupo protegido: sem sessão, vai para /login guardando o destino. */
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context, location }) => {
    const user = await ensureSession(context.queryClient);

    if (!user) {
      throw redirect({ to: '/login', search: { next: location.href }, replace: true });
    }

    return { user };
  },
  component: AppGroup,
});
