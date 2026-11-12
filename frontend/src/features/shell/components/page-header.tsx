import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import type { TreeCrumb } from '../tree-path';

export interface PageHeaderProps {
  wsId: string;
  title: string;
  /** Trilha do item: o último é a própria página e não vira link. */
  crumbs?: TreeCrumb[];
  description?: string;
  actions?: ReactNode;
}

function CrumbLink({ wsId, crumb }: { wsId: string; crumb: TreeCrumb }) {
  if (crumb.kind === 'space') {
    return (
      <Link to="/w/$wsId/s/$spaceId" params={{ wsId, spaceId: crumb.id }} className="text-muted">
        {crumb.name}
      </Link>
    );
  }

  if (crumb.kind === 'folder') {
    return (
      <Link to="/w/$wsId/f/$folderId" params={{ wsId, folderId: crumb.id }} className="text-muted">
        {crumb.name}
      </Link>
    );
  }

  return (
    <Link to="/w/$wsId/l/$listId" params={{ wsId, listId: crumb.id }} className="text-muted">
      {crumb.name}
    </Link>
  );
}

/** Cabeçalho de página: breadcrumb, título e ações. */
export function PageHeader({ wsId, title, crumbs = [], description, actions }: PageHeaderProps) {
  const trail = crumbs.slice(0, -1);

  return (
    <div className="flex flex-col gap-3 px-4 pt-5 md:px-6">
      {trail.length > 0 ? (
        <nav aria-label="Trilha" className="flex flex-wrap items-center gap-1 text-[12.5px]">
          {trail.map((crumb, index) => (
            <span key={crumb.id} className="flex items-center gap-1">
              {index > 0 ? (
                <ChevronRight className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
              ) : null}
              <CrumbLink wsId={wsId} crumb={crumb} />
            </span>
          ))}
        </nav>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="heading min-w-0 break-words text-2xl md:text-[28px]">{title}</h1>
        {actions}
      </div>

      {description ? <p className="text-[13px] text-muted">{description}</p> : null}
    </div>
  );
}
