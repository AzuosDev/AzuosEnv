import { createFileRoute } from '@tanstack/react-router';
import { DashboardsHub } from '@/features/dashboards/components/dashboards-hub';

function Page() {
  const { wsId } = Route.useParams();

  return <DashboardsHub wsId={wsId} />;
}

export const Route = createFileRoute('/_app/w/$wsId/dashboards/')({
  component: Page,
});
