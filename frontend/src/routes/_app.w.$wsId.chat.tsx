import { createFileRoute } from '@tanstack/react-router';
import { ChatPage } from '@/features/chat/components/chat-page';
import { PageSkeleton } from '@/features/shell/components/page-skeleton';
import { workspaceQuery } from '@/features/settings/api';

interface ChatSearch {
  /** Canal aberto. */
  canal?: string;
  /** Mensagem raiz da thread aberta. */
  thread?: string;
}

function Page() {
  const { wsId } = Route.useParams();
  const { canal, thread } = Route.useSearch();

  return <ChatPage wsId={wsId} channelId={canal} threadId={thread} />;
}

export const Route = createFileRoute('/_app/w/$wsId/chat')({
  validateSearch: (search: Record<string, unknown>): ChatSearch => ({
    ...(typeof search.canal === 'string' && search.canal !== '' ? { canal: search.canal } : {}),
    ...(typeof search.thread === 'string' && search.thread !== '' ? { thread: search.thread } : {}),
  }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(workspaceQuery(params.wsId)),
  component: Page,
  pendingComponent: PageSkeleton,
});
