import { createFileRoute } from '@tanstack/react-router';
import { PlannerPage } from '@/features/planner/components/planner-page';

function Page() {
  const { wsId } = Route.useParams();

  return <PlannerPage wsId={wsId} />;
}

export const Route = createFileRoute('/_app/w/$wsId/planner')({
  component: Page,
});
