import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CircleCheckBig, Folder as FolderIcon, List as ListIcon, Square } from 'lucide-react';
import type { ReactNode } from 'react';
import type { TrashEntityType, TrashItem } from '@/api/types';
import { StatusPill } from '@/components/ui/status-pill';
import { ENTITY_LABEL } from '../node-kinds';

const ICON: Record<TrashEntityType, typeof Square> = {
  space: Square,
  folder: FolderIcon,
  list: ListIcon,
  task: CircleCheckBig,
};

/** Data no fuso do navegador, em pt-BR. */
export function formatStamp(at: string): string {
  return format(new Date(at), "d 'de' MMM 'de' yyyy, HH:mm", { locale: ptBR });
}

export interface EntityListProps {
  items: TrashItem[];
  /** Rótulo da coluna de data ("Arquivado em" ou "Excluído em"). */
  stampLabel: string;
  actions: (item: TrashItem) => ReactNode;
}

/** Lista de itens guardados (arquivo ou lixeira), um por linha. */
export function EntityList({ items, stampLabel, actions }: EntityListProps) {
  return (
    <ul className="flex flex-col rounded-2xl border border-line bg-surface">
      {items.map((item) => {
        const Icon = ICON[item.entityType];

        return (
          <li
            key={`${item.entityType}-${item.id}`}
            className="flex flex-col gap-3 border-b border-line p-4 last:border-b-0 md:flex-row md:items-center md:justify-between"
          >
            <div className="flex min-w-0 items-start gap-3">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-[14px] font-medium text-ink">
                  {item.customId ? `${item.customId} · ` : ''}
                  {item.name}
                </p>
                <p className="mt-0.5 text-[12.5px] text-muted">
                  {stampLabel} {formatStamp(item.at)}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <StatusPill>{ENTITY_LABEL[item.entityType]}</StatusPill>
              {actions(item)}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
