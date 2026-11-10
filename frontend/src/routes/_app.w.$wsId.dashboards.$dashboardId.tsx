import { createFileRoute } from '@tanstack/react-router';
import { DashboardPanel } from '@/features/dashboards/components/dashboard-panel';

function Page() {
  const { wsId, dashboardId } = Route.useParams();

  return <DashboardPanel wsId={wsId} dashboardId={dashboardId} />;
}

export const Route = createFileRoute('/_app/w/$wsId/dashboards/$dashboardId')({
  component: Page,
});
