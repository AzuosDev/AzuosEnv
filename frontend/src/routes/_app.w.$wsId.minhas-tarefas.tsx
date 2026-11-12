import { createFileRoute } from '@tanstack/react-router';
import { MyTasksPage } from '@/features/my-tasks/components/my-tasks-page';

function Page() {
  const { wsId } = Route.useParams();

  return <MyTasksPage wsId={wsId} />;
}

export const Route = createFileRoute('/_app/w/$wsId/minhas-tarefas')({
  component: Page,
});
