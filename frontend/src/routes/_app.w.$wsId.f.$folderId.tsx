import { createFileRoute } from '@tanstack/react-router';
import { treeQuery } from '@/features/shell/api';
import { LocationPage } from '@/features/shell/components/location-page';
import { PageSkeleton } from '@/features/shell/components/page-skeleton';

function Page() {
  const { wsId, folderId } = Route.useParams();

  return <LocationPage wsId={wsId} kind="folder" id={folderId} />;
}

export const Route = createFileRoute('/_app/w/$wsId/f/$folderId')({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(treeQuery(params.wsId)),
  component: Page,
  pendingComponent: PageSkeleton,
});
