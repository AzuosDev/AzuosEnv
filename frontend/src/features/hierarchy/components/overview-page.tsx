import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Folder as FolderIcon, Lock } from 'lucide-react';
import type { TreeFolder, TreeList } from '@/api/types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusPill } from '@/components/ui/status-pill';
import { treeQuery } from '@/features/shell/api';
import { PageHeader } from '@/features/shell/components/page-header';
import { crumbsOf, findLocation, type TreeNodeKind } from '@/features/shell/tree-path';
import { colorSwatch } from '@/lib/colors';
import { cn } from '@/lib/utils';
import { refFromLocation } from '../node-ref';
import { iconOf, NODE_LABEL } from '../node-kinds';
import { useHierarchy } from './hierarchy-provider';
import { AddMenu, NodeMenu } from './node-menu';

const cardClass =
  'flex min-h-24 flex-col justify-between gap-2 rounded-2xl border border-line bg-surface p-4 no-underline hover:border-scene-line hover:bg-surface-2';

/** Tarefas abertas de tudo que está dentro do Folder. */
function openOf(folder: TreeFolder): number {
  return (
    folder.lists.reduce((total, list) => total + list.openTaskCount, 0) +
    folder.folders.reduce((total, child) => total + openOf(child), 0)
  );
}

function openLabel(count: number): string {
  return `${String(count)} ${count === 1 ? 'tarefa aberta' : 'tarefas abertas'}`;
}

function ListCard({ wsId, list }: { wsId: string; list: TreeList }) {
  return (
    <Link to="/w/$wsId/l/$listId" params={{ wsId, listId: list.id }} className={cardClass}>
      <span className="flex items-start gap-2">
        <span
          className={cn('mt-1 h-2.5 w-2.5 shrink-0 rounded-[3px]', colorSwatch(list.color))}
          aria-hidden="true"
        />
        <span className="min-w-0 text-[14px] font-semibold text-ink">{list.name}</span>
      </span>
      <StatusPill tone={list.openTaskCount > 0 ? 'info' : 'neutral'}>
        {openLabel(list.openTaskCount)}
      </StatusPill>
    </Link>
  );
}

function FolderCard({ wsId, folder }: { wsId: string; folder: TreeFolder }) {
  const lists = folder.lists.length;

  return (
    <Link to="/w/$wsId/f/$folderId" params={{ wsId, folderId: folder.id }} className={cardClass}>
      <span className="flex items-start gap-2">
        <FolderIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        <span className="min-w-0 text-[14px] font-semibold text-ink">{folder.name}</span>
        {folder.private ? (
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" aria-label="Privado" />
        ) : null}
      </span>
      <span className="text-[12.5px] text-muted">
        {lists === 1 ? '1 List' : `${String(lists)} Lists`} · {openLabel(openOf(folder))}
      </span>
    </Link>
  );
}

export interface OverviewPageProps {
  wsId: string;
  kind: Extract<TreeNodeKind, 'space' | 'folder'>;
  id: string;
}

/** Visão geral de um Space ou Folder: subfolders e Lists em cards. */
export function OverviewPage({ wsId, kind, id }: OverviewPageProps) {
  const { data: tree } = useSuspenseQuery(treeQuery(wsId));
  const { open } = useHierarchy();
  const location = findLocation(tree, kind, id);

  if (!location) {
    return (
      <div className="flex flex-col gap-5 pb-8">
        <PageHeader wsId={wsId} title={NODE_LABEL[kind]} />
        <div className="px-4 md:px-6">
          <EmptyState
            title={`${NODE_LABEL[kind]} não encontrado`}
            description="Ele pode ter sido arquivado, excluído ou você não tem acesso."
          />
        </div>
      </div>
    );
  }

  const node = refFromLocation(location);
  const space = tree.spaces.find((item) => item.id === node.spaceId);
  const self =
    kind === 'space'
      ? space
      : (function find(folders: TreeFolder[]): TreeFolder | undefined {
          for (const folder of folders) {
            if (folder.id === id) {
              return folder;
            }

            const found = find(folder.folders);

            if (found) {
              return found;
            }
          }

          return undefined;
        })(space?.folders ?? []);

  const folders = self?.folders ?? [];
  const lists = self?.lists ?? [];
  const total =
    folders.reduce((sum, folder) => sum + openOf(folder), 0) +
    lists.reduce((sum, list) => sum + list.openTaskCount, 0);
  const Icon = kind === 'space' ? iconOf(space?.icon) : FolderIcon;

  return (
    <div className="flex flex-col gap-5 pb-8">
      <PageHeader
        wsId={wsId}
        title={location.name}
        crumbs={crumbsOf(location)}
        description={openLabel(total)}
        actions={
          <span className="flex items-center gap-1">
            <AddMenu node={node} />
            <NodeMenu node={node} />
          </span>
        }
      />

      <div className="flex flex-col gap-4 px-4 md:px-6">
        {folders.length === 0 && lists.length === 0 ? (
          <EmptyState
            {...(Icon ? { icon: <Icon className="h-6 w-6" aria-hidden="true" /> } : {})}
            title="Nada aqui ainda"
            description={`Crie a primeira List deste ${NODE_LABEL[kind]} para começar a receber tarefas.`}
            action={
              <Button
                onClick={() => {
                  open({
                    type: 'createList',
                    parent: {
                      spaceId: node.spaceId,
                      folderId: kind === 'folder' ? id : null,
                    },
                  });
                }}
              >
                Nova List
              </Button>
            }
          />
        ) : null}

        {folders.length > 0 ? (
          <section aria-label="Folders" className="flex flex-col gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Folders
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {folders.map((folder) => (
                <FolderCard key={folder.id} wsId={wsId} folder={folder} />
              ))}
            </div>
          </section>
        ) : null}

        {lists.length > 0 ? (
          <section aria-label="Lists" className="flex flex-col gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Lists
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {lists.map((list) => (
                <ListCard key={list.id} wsId={wsId} list={list} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
