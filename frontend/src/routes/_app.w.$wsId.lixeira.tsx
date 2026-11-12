import { createFileRoute } from '@tanstack/react-router';
import { TrashPage } from '@/features/hierarchy/components/trash-page';

function Page() {
  const { wsId } = Route.useParams();

  return <TrashPage wsId={wsId} />;
}

export const Route = createFileRoute('/_app/w/$wsId/lixeira')({
  component: Page,
});
