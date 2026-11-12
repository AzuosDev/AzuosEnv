import { createFileRoute } from '@tanstack/react-router';
import { workspaceQuery } from '@/features/settings/api';
import { treeQuery } from '@/features/shell/api';
import { LocationPage } from '@/features/shell/components/location-page';
import { PageSkeleton } from '@/features/shell/components/page-skeleton';

function Page() {
  const { wsId, listId } = Route.useParams();

  return <LocationPage wsId={wsId} listId={listId} />;
}

export const Route = createFileRoute('/_app/w/$wsId/l/$listId')({
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(treeQuery(params.wsId)),
      context.queryClient.ensureQueryData(workspaceQuery(params.wsId)),
    ]);
  },
  component: Page,
  pendingComponent: PageSkeleton,
});
