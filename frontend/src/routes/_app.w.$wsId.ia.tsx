import { createFileRoute } from '@tanstack/react-router';
import { UnderConstruction } from '@/features/shell/components/under-construction';

function Page() {
  const { wsId } = Route.useParams();

  return <UnderConstruction wsId={wsId} title="IA" />;
}

export const Route = createFileRoute('/_app/w/$wsId/ia')({
  component: Page,
});
