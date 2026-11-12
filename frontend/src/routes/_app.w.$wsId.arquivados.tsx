import { createFileRoute } from '@tanstack/react-router';
import { ArchivedPage } from '@/features/hierarchy/components/archived-page';

function Page() {
  const { wsId } = Route.useParams();

  return <ArchivedPage wsId={wsId} />;
}

export const Route = createFileRoute('/_app/w/$wsId/arquivados')({
  component: Page,
});
