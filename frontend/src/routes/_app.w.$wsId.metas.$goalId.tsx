import { createFileRoute } from '@tanstack/react-router';
import { GoalDetail } from '@/features/goals/components/goal-detail';

function Page() {
  const { wsId, goalId } = Route.useParams();

  return <GoalDetail wsId={wsId} goalId={goalId} />;
}

export const Route = createFileRoute('/_app/w/$wsId/metas/$goalId')({
  component: Page,
});
