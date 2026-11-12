import { useSuspenseQuery } from '@tanstack/react-query';
import { EmptyState } from '@/components/ui/empty-state';
import { NodeMenu } from '@/features/hierarchy/components/node-menu';
import { refFromLocation } from '@/features/hierarchy/node-ref';
import { workspaceQuery } from '@/features/settings/api';
import { canAdmin } from '@/features/settings/roles';
import { SprintStrip } from '@/features/sprints/components/sprint-strip';
import { useSprints } from '@/features/sprints/hooks/use-sprints';
import { LocationViews } from '@/features/views/components/location-views';
import { treeQuery } from '../api';
import { crumbsOf, findLocation } from '../tree-path';
import { PageHeader } from './page-header';

export interface LocationPageProps {
  wsId: string;
  /** Id da List aberta; Spaces e Folders abrem na OverviewPage. */
  listId: string;
}

/**
 * Página da List: breadcrumb e título do /tree e, embaixo, a barra de views com
 * a view aberta. A página não rola: quem rola é a view.
 */
export function LocationPage({ wsId, listId }: LocationPageProps) {
  const { data: tree } = useSuspenseQuery(treeQuery(wsId));
  const { data: workspace } = useSuspenseQuery(workspaceQuery(wsId));
  const location = findLocation(tree, 'list', listId);
  const sprints = useSprints(wsId);
  const sprint = sprints.find(listId);

  if (!location) {
    return (
      <div className="flex flex-col gap-5 pb-8">
        <PageHeader wsId={wsId} title="List" />
        <div className="px-4 md:px-6">
          <EmptyState
            title="List não encontrada"
            description="Ela pode ter sido arquivada, excluída ou você não tem acesso."
          />
        </div>
      </div>
    );
  }

  const space = location.trail[0];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 pb-3">
        <PageHeader
          wsId={wsId}
          title={location.name}
          crumbs={crumbsOf(location)}
          actions={<NodeMenu node={refFromLocation(location)} />}
        />
      </div>

      {sprint ? (
        <div className="shrink-0 pb-3">
          <SprintStrip
            wsId={wsId}
            sprint={sprint.sprint}
            folder={sprint.folder}
            canEdit={canAdmin(workspace.role) || workspace.role === 'member'}
          />
        </div>
      ) : null}

      <LocationViews
        wsId={wsId}
        locationType="list"
        listId={listId}
        spaceId={space?.id ?? ''}
        role={workspace.role}
        listName={location.name}
      />
    </div>
  );
}
