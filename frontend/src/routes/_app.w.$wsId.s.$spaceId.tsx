import { createFileRoute } from '@tanstack/react-router';
import { treeQuery } from '@/features/shell/api';
import { LocationPage } from '@/features/shell/components/location-page';
import { PageSkeleton } from '@/features/shell/components/page-skeleton';

function Page() {
  const { wsId, spaceId } = Route.useParams();

  return <LocationPage wsId={wsId} kind="space" id={spaceId} />;
}

export const Route = createFileRoute('/_app/w/$wsId/s/$spaceId')({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(treeQuery(params.wsId)),
  component: Page,
  pendingComponent: PageSkeleton,
});
