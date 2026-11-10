import { createFileRoute } from '@tanstack/react-router';
import { AutomationsPage } from '@/features/automations/components/automations-page';

function Page() {
  const { wsId } = Route.useParams();

  return <AutomationsPage wsId={wsId} />;
}

export const Route = createFileRoute('/_app/w/$wsId/automacoes')({
  component: Page,
});
