import { HardHat } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from './page-header';

export interface UnderConstructionProps {
  wsId: string;
  title: string;
}

/** Página dos módulos que ainda não chegaram. */
export function UnderConstruction({ wsId, title }: UnderConstructionProps) {
  return (
    <div className="flex flex-col gap-5 pb-8">
      <PageHeader wsId={wsId} title={title} />
      <div className="px-4 md:px-6">
        <EmptyState
          title="Em construção"
          description={`${title} entra em uma etapa mais à frente do frontend.`}
          icon={<HardHat className="h-7 w-7" aria-hidden="true" />}
        />
      </div>
    </div>
  );
}
