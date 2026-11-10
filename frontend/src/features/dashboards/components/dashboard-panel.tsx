import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { GridLayout, useContainerWidth, type Layout } from 'react-grid-layout';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/keys';
import type { CardConfig, CardType, Dashboard, DashboardCard } from '@/api/types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Label } from '@/components/ui/label';
import { SelectNative } from '@/components/ui/select-native';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { FormAlert } from '@/features/auth/components/field';
import { useSession } from '@/features/auth/session';
import { PageHeader } from '@/features/shell/components/page-header';
import { saveBlob } from '@/features/timesheets/api';
import { useMinWidth } from '@/lib/use-min-width';
import { dashboardQuery, exportCardCsv, updateDashboard } from '../api';
import { cardKind, cardLabel } from '../card-kinds';
import {
  GRID_COLS,
  RANGE_LABEL,
  RANGE_PRESETS,
  ROW_HEIGHT,
  appendCard,
  applyLayout,
  presetRange,
  removeCard,
  replaceCard,
  singleColumn,
  toCardInputs,
  toLayout,
  type RangePreset,
} from '../card-model';
import { CardDialog } from './card-dialog';
import { CardFrame } from './card-frame';

/** Id do card novo; o backend aceita o que o front manda. */
function newCardId(): string {
  return `card-${String(Date.now())}-${String(Math.floor(Math.random() * 1000))}`;
}

export interface DashboardPanelProps {
  wsId: string;
  dashboardId: string;
}

/** Painel do dashboard: cards arrastáveis, redimensionáveis e com período. */
export function DashboardPanel({ wsId, dashboardId }: DashboardPanelProps) {
  const queryClient = useQueryClient();
  const session = useSession();
  const detail = useQuery(dashboardQuery(wsId, dashboardId));
  const wide = useMinWidth(768);
  const { width, containerRef } = useContainerWidth();
  const [preset, setPreset] = useState<RangePreset>('30d');
  const [cards, setCards] = useState<DashboardCard[]>([]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<DashboardCard | null>(null);
  const range = useMemo(() => presetRange(preset), [preset]);

  useEffect(() => {
    if (detail.data) {
      setCards(detail.data.cards);
    }
  }, [detail.data]);

  const save = useMutation({
    mutationFn: (next: DashboardCard[]) =>
      updateDashboard(wsId, dashboardId, { cards: toCardInputs(next) }),
    onSuccess: (dashboard: Dashboard) => {
      queryClient.setQueryData(queryKeys.dashboard(wsId, dashboardId), dashboard);
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboards(wsId) });
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error));

      if (detail.data) {
        setCards(detail.data.cards);
      }
    },
  });

  const commit = (next: DashboardCard[]): void => {
    setCards(next);
    save.mutate(next);
  };

  if (detail.isPending) {
    return <Skeleton className="m-4 h-64 md:m-6" />;
  }

  if (detail.isError) {
    return (
      <div className="p-4 md:p-6">
        <FormAlert>{errorMessage(detail.error)}</FormAlert>
      </div>
    );
  }

  const canEdit = detail.data.ownerId === session?.id || !detail.data.private;
  const onExport = (cardId: string, type: CardType): void => {
    void exportCardCsv(wsId, dashboardId, cardId)
      .then((blob) => {
        saveBlob(blob, `${type}.csv`);
      })
      .catch((error: unknown) => {
        toast.error(errorMessage(error));
      });
  };

  const frameOf = (card: DashboardCard, draggable: boolean) => (
    <CardFrame
      wsId={wsId}
      dashboardId={dashboardId}
      card={card}
      range={range}
      draggable={draggable}
      canEdit={canEdit}
      onConfigure={() => {
        setEditing(card);
      }}
      onRemove={() => {
        commit(removeCard(cards, card.id));
      }}
      onExport={() => {
        onExport(card.id, card.type);
      }}
    />
  );

  return (
    <div className="flex min-w-0 flex-col gap-4 pb-10">
      <PageHeader
        wsId={wsId}
        title={detail.data.name}
        description={
          detail.data.private ? 'Dashboard privado: só você vê.' : 'Dashboard do workspace.'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="dash-range" className="sr-only">
              Período
            </Label>
            <SelectNative
              id="dash-range"
              className="h-9 w-auto md:h-9"
              value={preset}
              onChange={(event) => {
                setPreset(event.target.value as RangePreset);
              }}
            >
              {RANGE_PRESETS.map((value) => (
                <option key={value} value={value}>
                  {RANGE_LABEL[value]}
                </option>
              ))}
            </SelectNative>
            {canEdit ? (
              <Button
                size="sm"
                onClick={() => {
                  setAdding(true);
                }}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Card
              </Button>
            ) : null}
          </div>
        }
      />

      <div ref={containerRef} className="min-w-0 px-4 md:px-6">
        {cards.length === 0 ? (
          <EmptyState
            title="Nenhum card ainda"
            description="Adicione um card para ver status, carga, tempo e progresso do trabalho."
          />
        ) : wide ? (
          <GridLayout
            width={width}
            layout={toLayout(cards)}
            gridConfig={{ cols: GRID_COLS, rowHeight: ROW_HEIGHT, margin: [12, 12] }}
            dragConfig={{
              enabled: canEdit,
              handle: '.card-drag-handle',
              allowMobileScroll: true,
            }}
            resizeConfig={{ enabled: canEdit, handles: ['se'] }}
            onLayoutChange={(layout: Layout) => {
              const next = applyLayout(cards, layout);

              if (JSON.stringify(toLayout(next)) !== JSON.stringify(toLayout(cards))) {
                commit(next);
              }
            }}
          >
            {cards.map((card) => (
              <div key={card.id} className="min-w-0">
                {frameOf(card, canEdit)}
              </div>
            ))}
          </GridLayout>
        ) : (
          <div className="flex min-w-0 flex-col gap-3">
            {singleColumn(cards).map((card) => (
              <div
                key={card.id}
                className="min-h-[220px] min-w-0"
                style={{ height: `${String(card.h * ROW_HEIGHT)}px` }}
              >
                {frameOf(card, false)}
              </div>
            ))}
          </div>
        )}
      </div>

      <CardDialog
        wsId={wsId}
        open={adding}
        onOpenChange={setAdding}
        onConfirm={(value: { type: CardType; config: CardConfig }) => {
          commit(appendCard(cards, value.type, value.config, newCardId()));
          toast.success(`Card ${cardLabel(value.type)} adicionado.`);
        }}
      />

      <CardDialog
        wsId={wsId}
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
          }
        }}
        initial={editing ? { type: editing.type, config: editing.config } : undefined}
        onConfirm={(value) => {
          if (!editing) {
            return;
          }

          const kind = cardKind(value.type);

          commit(
            replaceCard(cards, {
              ...editing,
              type: value.type,
              config: value.config,
              w: editing.type === value.type ? editing.w : kind.size.w,
              h: editing.type === value.type ? editing.h : kind.size.h,
            }),
          );
          setEditing(null);
        }}
      />
    </div>
  );
}
