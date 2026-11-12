import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ChevronRight, Plus } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Brand } from '@/features/auth/components/auth-layout';
import { UserMenu } from '@/features/auth/components/user-menu';
import { useSession } from '@/features/auth/session';
import { workspacesQuery } from '@/features/workspaces/api';
import { initials } from '@/lib/utils';

function WorkspacePickerPage() {
  const { data: workspaces } = useSuspenseQuery(workspacesQuery);
  const user = useSession();

  return (
    <main className="stage relative flex min-h-dvh w-full flex-col items-center overflow-hidden px-4 py-8">
      <div className="dot-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="relative flex w-full max-w-lg flex-col gap-6">
        <header className="flex items-center justify-between gap-3">
          <Brand />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {user ? <UserMenu user={user} /> : null}
          </div>
        </header>

        <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <h1 className="heading text-xl">Escolha um workspace</h1>
          <p className="mt-2 text-[13px] text-muted">
            Você participa de {workspaces.length} workspace{workspaces.length === 1 ? '' : 's'}.
          </p>

          <ul className="mt-5 flex flex-col gap-2">
            {workspaces.map((workspace) => (
              <li key={workspace.id}>
                <Link
                  to="/w/$wsId"
                  params={{ wsId: workspace.id }}
                  className="flex min-h-14 items-center gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2 text-ink no-underline hover:border-scene-line"
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-scene text-[12px] font-bold text-ink"
                    aria-hidden="true"
                  >
                    {initials(workspace.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{workspace.name}</span>
                    <span className="block truncate text-[12px] text-muted">
                      {workspace.taskPrefix}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>

          <Button asChild variant="ghost" className="mt-5 w-full">
            <Link to="/onboarding">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Criar workspace
            </Link>
          </Button>
        </section>
      </div>
    </main>
  );
}

export const Route = createFileRoute('/_app/workspaces')({
  loader: ({ context }) => context.queryClient.ensureQueryData(workspacesQuery),
  component: WorkspacePickerPage,
});
