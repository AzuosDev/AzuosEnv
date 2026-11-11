import { createFileRoute } from '@tanstack/react-router';
import { BoardView } from '@/features/whiteboards/components/board-view';

function Page() {
  const { wsId, whiteboardId } = Route.useParams();

  return <BoardView wsId={wsId} whiteboardId={whiteboardId} />;
}

export const Route = createFileRoute('/_app/w/$wsId/whiteboards/$whiteboardId')({
  component: Page,
});
