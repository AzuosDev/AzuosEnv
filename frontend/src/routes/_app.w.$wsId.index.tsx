import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/features/shell/components/page-header';
import { PageSkeleton } from '@/features/shell/components/page-skeleton';
import { workspacesQuery } from '@/features/workspaces/api';

function WorkspaceHomePage() {
  const { wsId } = Route.useParams();
  const { data: workspaces } = useSuspenseQuery(workspacesQuery);
  const workspace = workspaces.find((item) => item.id === wsId);

  return (
    <div className="flex flex-col gap-5 pb-8">
      <PageHeader
        wsId={wsId}
        title={workspace?.name ?? 'Workspace'}
        description="Escolha uma List na navegação para ver as tarefas."
      />
      <div className="px-4 md:px-6">
        <EmptyState
          title="Comece por uma List"
          description="Abra um Space, um Folder ou uma List na sidebar. As views das tarefas entram na etapa das views."
        />
      </div>
    </div>
  );
}

export const Route = createFileRoute('/_app/w/$wsId/')({
  component: WorkspaceHomePage,
  pendingComponent: PageSkeleton,
});
