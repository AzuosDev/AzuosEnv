import { createFileRoute } from '@tanstack/react-router';
import { SlidersHorizontal } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

/** Acima de 768 px a coluna da direita começa vazia; abaixo, só a lista aparece. */
function Page() {
  return (
    <EmptyState
      title="Escolha uma seção"
      description="Sua conta e as notificações e, para quem administra, o workspace, as pessoas, as integrações e os dados."
      icon={<SlidersHorizontal className="h-7 w-7" aria-hidden="true" />}
    />
  );
}

export const Route = createFileRoute('/_app/w/$wsId/configuracoes/')({ component: Page });
