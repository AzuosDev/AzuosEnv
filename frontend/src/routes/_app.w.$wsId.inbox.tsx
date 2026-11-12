import { createFileRoute } from '@tanstack/react-router';
import { InboxPage } from '@/features/inbox/components/inbox-page';

function Page() {
  const { wsId } = Route.useParams();

  return <InboxPage wsId={wsId} />;
}

export const Route = createFileRoute('/_app/w/$wsId/inbox')({
  component: Page,
});
