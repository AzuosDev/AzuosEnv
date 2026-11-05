import { createFileRoute } from '@tanstack/react-router';
import { OverviewPage } from '@/features/hierarchy/components/overview-page';
import { treeQuery } from '@/features/shell/api';
import { PageSkeleton } from '@/features/shell/components/page-skeleton';

function Page() {
  const { wsId, folderId } = Route.useParams();

  return <OverviewPage wsId={wsId} kind="folder" id={folderId} />;
}

export const Route = createFileRoute('/_app/w/$wsId/f/$folderId')({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(treeQuery(params.wsId)),
  component: Page,
  pendingComponent: PageSkeleton,
});
