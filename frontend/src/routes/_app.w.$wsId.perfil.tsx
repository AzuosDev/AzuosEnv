import { createFileRoute } from '@tanstack/react-router';
import { UnderConstruction } from '@/features/shell/components/under-construction';

function Page() {
  const { wsId } = Route.useParams();

  return <UnderConstruction wsId={wsId} title="Perfil" />;
}

export const Route = createFileRoute('/_app/w/$wsId/perfil')({
  component: Page,
});
