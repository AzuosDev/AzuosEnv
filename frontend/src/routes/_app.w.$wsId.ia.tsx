import { createFileRoute } from '@tanstack/react-router';
import { AiPage } from '@/features/ai/components/ai-page';

function Page() {
  const { wsId } = Route.useParams();

  return <AiPage wsId={wsId} />;
}

export const Route = createFileRoute('/_app/w/$wsId/ia')({
  component: Page,
});
