import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { workspaceQuery } from '@/features/settings/api';
import { PageHeader } from '@/features/shell/components/page-header';
import { PageSkeleton } from '@/features/shell/components/page-skeleton';
import { treeQuery } from '@/features/shell/api';
import { LocationViews } from '@/features/views/components/location-views';

/**
 * View "Tudo": as tarefas do workspace inteiro, com as mesmas views da List.
 * Sem List no escopo, a criação rápida sai de cena e a tarefa nova vem da
 * topbar, que escolhe a List no diálogo.
 */
function Page() {
  const { wsId } = Route.useParams();
  const { data: workspace } = useSuspenseQuery(workspaceQuery(wsId));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 pb-3">
        <PageHeader
          wsId={wsId}
          title="Tudo"
          description="Todas as tarefas que você pode ver neste workspace."
        />
      </div>

      <LocationViews
        wsId={wsId}
        locationType="everything"
        listId=""
        spaceId=""
        role={workspace.role}
      />
    </div>
  );
}

export const Route = createFileRoute('/_app/w/$wsId/tudo')({
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(treeQuery(params.wsId)),
      context.queryClient.ensureQueryData(workspaceQuery(params.wsId)),
    ]);
  },
  component: Page,
  pendingComponent: PageSkeleton,
});
