import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { ensureSession } from '@/features/auth/session';

/** Grupo protegido: sem sessão, vai para /login guardando o destino. */
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context, location }) => {
    const user = await ensureSession(context.queryClient);

    if (!user) {
      throw redirect({ to: '/login', search: { next: location.href }, replace: true });
    }

    return { user };
  },
  component: Outlet,
});
