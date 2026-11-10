import { useQuery } from '@tanstack/react-query';
import { Download, GripVertical, MoreHorizontal, Settings2, Trash2 } from 'lucide-react';
import { errorMessage } from '@/api/errors';
import type { CardConfig, DashboardCard } from '@/api/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { FormAlert } from '@/features/auth/components/field';
import { cardKind } from '../card-kinds';
import { cardDataQuery } from '../api';
import { effectiveConfig, type DateRange } from '../card-model';
import { useChartPalette } from '../hooks/use-chart-palette';
import { CardBody } from './card-body';

export interface CardFrameProps {
  wsId: string;
  dashboardId: string;
  card: DashboardCard;
  range: DateRange | null;
  /** Falso no celular: sem alça de arrastar. */
  draggable: boolean;
  canEdit: boolean;
  onConfigure: () => void;
  onRemove: () => void;
  onExport: () => void;
}

/** Recorte efetivo do card; o painel só preenche o que o card não fixou. */
function configOf(card: DashboardCard, range: DateRange | null): CardConfig {
  return effectiveConfig(card.config, cardKind(card.type).fields.includes('range') ? range : null);
}

/** Moldura do card: título, menu, alça de arrastar e o corpo com os dados. */
export function CardFrame({
  wsId,
  dashboardId,
  card,
  range,
  draggable,
  canEdit,
  onConfigure,
  onRemove,
  onExport,
}: CardFrameProps) {
  const kind = cardKind(card.type);
  const config = configOf(card, range);
  const ready = !kind.needsRange || (config.from !== undefined && config.to !== undefined);
  const result = useQuery(cardDataQuery(wsId, dashboardId, card.id, config, ready));
  const palette = useChartPalette();

  return (
    <section
      aria-label={kind.label}
      className="flex h-full min-h-0 min-w-0 flex-col gap-2 overflow-hidden rounded-2xl border border-line bg-surface p-4"
    >
      <header className="flex min-w-0 items-center gap-1.5">
        {draggable ? (
          <span
            aria-hidden="true"
            className="card-drag-handle -ml-1 cursor-grab touch-none text-muted"
          >
            <GripVertical className="h-4 w-4" />
          </span>
        ) : null}
        <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">{kind.label}</h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="nav" size="icon" aria-label={`Ações do card ${kind.label}`}>
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canEdit ? (
              <DropdownMenuItem onSelect={onConfigure}>
                <Settings2 className="h-4 w-4" aria-hidden="true" />
                Configurar
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onSelect={onExport}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Exportar CSV
            </DropdownMenuItem>
            {canEdit ? (
              <DropdownMenuItem onSelect={onRemove}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Remover
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        {!ready ? (
          <p className="text-[13px] text-muted">Escolha um período para este card.</p>
        ) : result.isPending ? (
          <Skeleton className="h-full min-h-[100px]" />
        ) : result.isError ? (
          <FormAlert>{errorMessage(result.error)}</FormAlert>
        ) : (
          <CardBody wsId={wsId} type={card.type} data={result.data.data} palette={palette} />
        )}
      </div>
    </section>
  );
}
