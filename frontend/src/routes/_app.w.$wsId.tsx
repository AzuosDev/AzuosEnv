import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { Repeat2 } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';
import { UserMenu } from '@/features/auth/components/user-menu';
import { useSession } from '@/features/auth/session';
import { workspacesQuery } from '@/features/workspaces/api';

function WorkspaceHomePage() {
  const { wsId } = Route.useParams();
  const { data: workspaces } = useSuspenseQuery(workspacesQuery);
  const user = useSession();
  const workspace = workspaces.find((item) => item.id === wsId);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center gap-3 border-b border-line bg-paper-2 px-4 py-3">
        <span
          className="btn-signal flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[13px] font-bold"
          aria-hidden="true"
        >
          &lt;/&gt;
        </span>
        <div className="min-w-0 flex-1">
          <p className="heading truncate text-base">{workspace?.name ?? 'Azuos Env'}</p>
          <p className="truncate text-[12px] text-muted">{workspace?.taskPrefix}</p>
        </div>
        {workspaces.length > 1 ? (
          <Button asChild variant="ghost" size="icon" title="Trocar de workspace">
            <Link to="/workspaces" aria-label="Trocar de workspace">
              <Repeat2 className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        ) : null}
        <ThemeToggle />
        {user ? <UserMenu user={user} /> : null}
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6">
        <section className="stage relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-scene-line p-6">
          <div className="dot-grid pointer-events-none absolute inset-0" aria-hidden="true" />
          <StatusPill tone="accent" className="relative w-fit">
            Etapa F2
          </StatusPill>
          <h1 className="heading relative text-2xl">Sessão ativa</h1>
          <p className="relative max-w-xl text-[13px] text-body">
            Login, cadastro, convite e escolha de workspace prontos. A navegação do app entra na
            próxima etapa.
          </p>
        </section>
      </main>
    </div>
  );
}

export const Route = createFileRoute('/_app/w/$wsId')({
  loader: async ({ context, params }) => {
    const workspaces = await context.queryClient.ensureQueryData(workspacesQuery);

    if (workspaces.some((workspace) => workspace.id === params.wsId)) {
      return;
    }

    if (workspaces.length === 0) {
      throw redirect({ to: '/onboarding', replace: true });
    }

    throw redirect({ to: '/workspaces', replace: true });
  },
  component: WorkspaceHomePage,
});
