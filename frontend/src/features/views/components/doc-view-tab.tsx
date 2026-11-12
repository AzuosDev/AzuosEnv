import { useState } from 'react';
import type { View } from '@/api/types';
import { EmptyState } from '@/components/ui/empty-state';
import { DocEditor } from '@/features/docs/components/doc-editor';

/**
 * View do tipo Doc: o Doc do local aberto como aba, sem sair da página do local.
 * O id vem de `config.options.docId`, gravado pela API quando o Doc nasce ali.
 */
export function DocViewTab({ wsId, view }: { wsId: string; view: View | null }) {
  const [pageId, setPageId] = useState<string | undefined>(undefined);
  const docId = view?.config.options?.['docId'];

  if (typeof docId !== 'string' || docId === '') {
    return (
      <div className="px-4 pb-8 md:px-6">
        <EmptyState
          title="Esta aba não aponta para nenhum Doc"
          description="A aba de Doc nasce junto com o Doc do local. Crie um Doc neste local pelo hub de Docs."
        />
      </div>
    );
  }

  return (
    <DocEditor
      wsId={wsId}
      docId={docId}
      {...(pageId !== undefined ? { pageId } : {})}
      onPickPage={setPageId}
    />
  );
}
