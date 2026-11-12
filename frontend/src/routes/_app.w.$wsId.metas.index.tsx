import { createFileRoute } from '@tanstack/react-router';
import { GoalsPage } from '@/features/goals/components/goals-page';

function Page() {
  const { wsId } = Route.useParams();

  return <GoalsPage wsId={wsId} />;
}

export const Route = createFileRoute('/_app/w/$wsId/metas/')({
  component: Page,
});
