import { createFileRoute } from '@tanstack/react-router';
import { OverviewPage } from '@/features/hierarchy/components/overview-page';
import { treeQuery } from '@/features/shell/api';
import { PageSkeleton } from '@/features/shell/components/page-skeleton';

function Page() {
  const { wsId, spaceId } = Route.useParams();

  return <OverviewPage wsId={wsId} kind="space" id={spaceId} />;
}

export const Route = createFileRoute('/_app/w/$wsId/s/$spaceId')({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(treeQuery(params.wsId)),
  component: Page,
  pendingComponent: PageSkeleton,
});
