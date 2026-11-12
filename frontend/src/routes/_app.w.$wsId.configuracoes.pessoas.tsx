import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useSession } from '@/features/auth/session';
import { invitesQuery, membersQuery, workspaceQuery } from '@/features/settings/api';
import { InviteForm } from '@/features/settings/components/invite-form';
import { InvitesList } from '@/features/settings/components/invites-list';
import { MembersList } from '@/features/settings/components/members-list';
import { PanelSkeleton } from '@/features/settings/components/panel-skeleton';
import { ensureAdmin } from '@/features/settings/guards';

function Page() {
  const { wsId } = Route.useParams();
  const { data: detail } = useSuspenseQuery(workspaceQuery(wsId));
  const user = useSession();

  return (
    <>
      <InviteForm wsId={wsId} />
      <MembersList wsId={wsId} role={detail.role} currentUserId={user?.id ?? ''} />
      <InvitesList wsId={wsId} />
    </>
  );
}

export const Route = createFileRoute('/_app/w/$wsId/configuracoes/pessoas')({
  beforeLoad: ({ context, params }) => ensureAdmin(context.queryClient, params.wsId),
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(membersQuery(params.wsId)),
      context.queryClient.ensureQueryData(invitesQuery(params.wsId)),
    ]);
  },
  component: Page,
  pendingComponent: PanelSkeleton,
});
