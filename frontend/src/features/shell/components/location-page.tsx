import { useSuspenseQuery } from '@tanstack/react-query';
import { EmptyState } from '@/components/ui/empty-state';
import { NodeMenu } from '@/features/hierarchy/components/node-menu';
import { refFromLocation } from '@/features/hierarchy/node-ref';
import { treeQuery } from '../api';
import { crumbsOf, findLocation, type TreeNodeKind } from '../tree-path';
import { PageHeader } from './page-header';

const LABEL: Record<TreeNodeKind, string> = {
  space: 'Space',
  folder: 'Folder',
  list: 'List',
};

export interface LocationPageProps {
  wsId: string;
  kind: TreeNodeKind;
  id: string;
}

/**
 * Página de um local da hierarquia: breadcrumb e título vindos do /tree. As
 * views (Lista, Quadro, Calendário…) entram na etapa delas.
 */
export function LocationPage({ wsId, kind, id }: LocationPageProps) {
  const { data: tree } = useSuspenseQuery(treeQuery(wsId));
  const location = findLocation(tree, kind, id);

  if (!location) {
    return (
      <div className="flex flex-col gap-5 pb-8">
        <PageHeader wsId={wsId} title={LABEL[kind]} />
        <div className="px-4 md:px-6">
          <EmptyState
            title={`${LABEL[kind]} não encontrado`}
            description="Ele pode ter sido arquivado, excluído ou você não tem acesso."
          />
        </div>
      </div>
    );
  }

  const open = location.openTaskCount;

  return (
    <div className="flex flex-col gap-5 pb-8">
      <PageHeader
        wsId={wsId}
        title={location.name}
        crumbs={crumbsOf(location)}
        actions={<NodeMenu node={refFromLocation(location)} />}
        {...(open === null
          ? {}
          : { description: `${String(open)} ${open === 1 ? 'tarefa aberta' : 'tarefas abertas'}` })}
      />
      <div className="px-4 md:px-6">
        <EmptyState
          title="As views chegam na próxima etapa"
          description="Lista, Quadro, Calendário, Tabela, Gantt e Workload deste local entram na etapa das views."
        />
      </div>
    </div>
  );
}
