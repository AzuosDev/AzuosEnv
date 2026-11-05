import { createFileRoute } from '@tanstack/react-router';
import { treeQuery } from '@/features/shell/api';
import { LocationPage } from '@/features/shell/components/location-page';
import { PageSkeleton } from '@/features/shell/components/page-skeleton';

function Page() {
  const { wsId, listId } = Route.useParams();

  return <LocationPage wsId={wsId} kind="list" id={listId} />;
}

export const Route = createFileRoute('/_app/w/$wsId/l/$listId')({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(treeQuery(params.wsId)),
  component: Page,
  pendingComponent: PageSkeleton,
});
