import { createFileRoute } from '@tanstack/react-router';
import { PublicFormPage } from '@/features/forms/components/public-form-page';

function Page() {
  const { token } = Route.useParams();

  return <PublicFormPage token={token} />;
}

/** Formulário público: fora do grupo _public, porque não redireciona quem tem sessão. */
export const Route = createFileRoute('/f/$token')({
  component: Page,
});
