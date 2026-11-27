import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, Outlet, useRouterState } from '@tanstack/react-router';
import { ChevronLeft } from 'lucide-react';
import { PageHeader } from '@/features/shell/components/page-header';
import { workspaceQuery } from '@/features/settings/api';
import { SettingsNav } from '@/features/settings/components/settings-nav';
import { SettingsTabs } from '@/features/settings/components/settings-tabs';
import { activeSettings } from '@/features/settings/sections';
import { cn } from '@/lib/utils';

function SettingsLayout() {
  const { wsId } = Route.useParams();
  const { data: detail } = useSuspenseQuery(workspaceQuery(wsId));
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const active = activeSettings(pathname, wsId, detail.role);
  const isIndex = active === null;
  // Seção de uma aba só não tem barra de abas: o cabeçalho fala pela aba.
  const single = active !== null && active.section.tabs.length < 2;
  const heading = single ? active.tab : active?.section;

  return (
    <div className="flex flex-col gap-4 pb-10">
      <PageHeader
        wsId={wsId}
        title={heading ? heading.label : 'Configurações'}
        description={
          heading ? heading.description : 'Sua conta, o workspace e quem participa dele.'
        }
      />

      <div className="flex gap-6 px-4 md:px-6">
        <SettingsNav
          wsId={wsId}
          role={detail.role}
          activeId={active?.section.id ?? null}
          className={cn('w-full md:w-56 md:shrink-0', isIndex ? 'flex' : 'hidden md:flex')}
        />

        <div className={cn('min-w-0 flex-1 flex-col gap-4', isIndex ? 'hidden md:flex' : 'flex')}>
          {active ? (
            <Link
              to="/w/$wsId/configuracoes"
              params={{ wsId }}
              className="inline-flex min-h-11 items-center gap-1 self-start text-[13px] text-muted no-underline md:hidden"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Todas as configurações
            </Link>
          ) : null}

          {active ? (
            <SettingsTabs wsId={wsId} section={active.section} activeId={active.tab.id} />
          ) : null}

          <Outlet />
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/_app/w/$wsId/configuracoes')({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(workspaceQuery(params.wsId)),
  component: SettingsLayout,
});
