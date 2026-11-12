import { createFileRoute, redirect } from '@tanstack/react-router';
import { queryKeys } from '@/api/keys';
import { Spinner } from '@/components/ui/spinner';
import { safeNext, workspaceRedirect } from '@/features/auth/navigation';
import { ensureSession } from '@/features/auth/session';
import { workspacesQuery } from '@/features/workspaces/api';

/** Volta do Google: a sessão já veio no cookie, aqui só esperamos o refresh. */
function CallbackPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper px-5 py-10">
      <div className="flex w-full max-w-[360px] flex-col items-center gap-4 text-center">
        <span
          className="btn-signal grid h-11 w-11 place-items-center rounded-xl text-[12px] font-bold"
          aria-hidden="true"
        >
          &lt;/&gt;
        </span>
        <h1 className="heading text-[1.25rem]">Entrando com o Google</h1>
        <p className="text-sm text-muted">Só um instante, estamos abrindo a sua sessão.</p>
        <Spinner className="h-5 w-5" label="Entrando com o Google" />
      </div>
    </main>
  );
}

export const Route = createFileRoute('/auth/callback')({
  validateSearch: (search: Record<string, unknown>): { next?: string } => ({
    next: typeof search.next === 'string' ? search.next : undefined,
  }),
  // O cookie de refresh acabou de trocar: nada do que estava em cache vale.
  beforeLoad: async ({ context, search }) => {
    const { queryClient } = context;

    queryClient.removeQueries({ queryKey: queryKeys.session() });
    queryClient.removeQueries({ queryKey: queryKeys.workspaces() });

    const user = await ensureSession(queryClient);

    if (!user) {
      throw redirect({ to: '/login', search: { erro: 'google' }, replace: true });
    }

    if (search.next) {
      throw redirect({ to: safeNext(search.next), replace: true });
    }

    workspaceRedirect(await queryClient.ensureQueryData(workspacesQuery));
  },
  component: CallbackPage,
  pendingComponent: CallbackPage,
  pendingMs: 0,
});
