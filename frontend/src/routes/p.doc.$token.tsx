import { createFileRoute } from '@tanstack/react-router';
import { PublicDocView } from '@/features/docs/components/public-doc-view';

function Page() {
  const { token } = Route.useParams();

  return <PublicDocView token={token} />;
}

/** Página pública do Doc: fora do grupo _public, porque não redireciona quem tem sessão. */
export const Route = createFileRoute('/p/doc/$token')({
  component: Page,
});
