import { createFileRoute } from '@tanstack/react-router';
import { WhiteboardsHub } from '@/features/whiteboards/components/whiteboards-hub';

function Page() {
  const { wsId } = Route.useParams();

  return <WhiteboardsHub wsId={wsId} />;
}

export const Route = createFileRoute('/_app/w/$wsId/whiteboards/')({
  component: Page,
});
