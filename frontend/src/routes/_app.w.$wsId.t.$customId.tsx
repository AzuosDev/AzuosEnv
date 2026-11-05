import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { EmptyState } from '@/components/ui/empty-state';
import { Spinner } from '@/components/ui/spinner';
import { PageHeader } from '@/features/shell/components/page-header';
import { PageSkeleton } from '@/features/shell/components/page-skeleton';
import { taskQuery } from '@/features/tasks/api';

/**
 * Página da tarefa. Na F6 ela só mostra o nome e o ID; o painel completo
 * (descrição, subtarefas, comentários e tempo) entra na etapa seguinte.
 */
function Page() {
  const { wsId, customId } = Route.useParams();
  const task = useQuery(taskQuery(wsId, customId));

  if (task.isPending) {
    return (
      <div className="px-4 py-8 md:px-6">
        <Spinner label="Carregando a tarefa" />
      </div>
    );
  }

  if (task.isError || !task.data) {
    return (
      <div className="flex flex-col gap-5 pb-8">
        <PageHeader wsId={wsId} title="Tarefa" />
        <div className="px-4 md:px-6">
          <EmptyState
            title="Tarefa não encontrada"
            description="Ela pode estar na lixeira ou você não tem acesso."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-8">
      <PageHeader wsId={wsId} title={task.data.name} description={task.data.customId} />
      <div className="px-4 md:px-6">
        <EmptyState
          title="O painel da tarefa chega na próxima etapa"
          description="Descrição, subtarefas, checklists, comentários, anexos e tempo entram juntos."
        />
      </div>
    </div>
  );
}

export const Route = createFileRoute('/_app/w/$wsId/t/$customId')({
  component: Page,
  pendingComponent: PageSkeleton,
});
