import { createFileRoute } from '@tanstack/react-router';
import { DocsHub } from '@/features/docs/components/docs-hub';

function Page() {
  const { wsId } = Route.useParams();

  return <DocsHub wsId={wsId} />;
}

export const Route = createFileRoute('/_app/w/$wsId/docs/')({
  component: Page,
});
