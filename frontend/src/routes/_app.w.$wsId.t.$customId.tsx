import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { workspaceQuery } from '@/features/settings/api';
import { treeQuery } from '@/features/shell/api';
import { LocationPage } from '@/features/shell/components/location-page';
import { PageSkeleton } from '@/features/shell/components/page-skeleton';
import { taskQuery } from '@/features/tasks/api';
import {
  MAX_PANEL_WIDTH,
  MIN_PANEL_WIDTH,
  clampPanelWidth,
  readPanelMode,
  readPanelWidth,
  writePanelMode,
  writePanelWidth,
  type PanelMode,
} from '@/features/tasks/panel-mode';
import { TaskPanel } from '@/features/tasks/components/task-panel';
import { cn } from '@/lib/utils';

/** Passo do teclado na alça de redimensionar. */
const RESIZE_STEP = 24;

/** A partir daqui o painel abre sobre a view; abaixo, ocupa a tela. */
const WIDE = 1024;

function useWide(): boolean {
  const [wide, setWide] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= WIDE,
  );

  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${String(WIDE)}px)`);
    const onChange = (): void => {
      setWide(query.matches);
    };

    onChange();
    query.addEventListener('change', onChange);

    return () => {
      query.removeEventListener('change', onChange);
    };
  }, []);

  return wide;
}

/**
 * Página da tarefa. A rota é direta (/w/:wsId/t/:customId), então ela desenha a
 * view da List por baixo e o painel por cima: o link direto abre no mesmo lugar
 * em que um clique na Lista abre.
 */
function Page() {
  const { wsId, customId } = Route.useParams();
  const router = useRouter();
  const wide = useWide();
  const task = useQuery(taskQuery(wsId, customId));
  const [mode, setMode] = useState<PanelMode>(() => readPanelMode());
  const [width, setWidth] = useState(() => readPanelWidth());
  const [resizing, setResizing] = useState(false);
  const latest = useRef(width);

  latest.current = width;

  const close = useCallback(() => {
    const listId = task.data?.listId;

    if (listId) {
      void router.navigate({ to: '/w/$wsId/l/$listId', params: { wsId, listId } });

      return;
    }

    void router.navigate({ to: '/w/$wsId', params: { wsId } });
  }, [router, task.data?.listId, wsId]);

  // Esc fecha o painel de qualquer modo, inclusive na tela cheia do celular.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        close();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [close]);

  // Arrastar a alça: o ponteiro vira largura enquanto o botão está apertado.
  useEffect(() => {
    if (!resizing) {
      return;
    }

    const onMove = (event: PointerEvent): void => {
      setWidth(clampPanelWidth(window.innerWidth - event.clientX, window.innerWidth));
    };

    const onUp = (): void => {
      setResizing(false);
      writePanelWidth(latest.current);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [resizing]);

  const onMode = (next: PanelMode): void => {
    setMode(next);
    writePanelMode(next);
  };

  const resize = (next: number): void => {
    const clamped = clampPanelWidth(next, window.innerWidth);

    setWidth(clamped);
    writePanelWidth(clamped);
  };

  const panel = (
    <TaskPanel
      wsId={wsId}
      customId={customId}
      mode={wide ? mode : null}
      onMode={onMode}
      onClose={close}
    />
  );

  // Abaixo de 1024 px o painel é a própria tela, com o botão voltar no topo.
  if (!wide) {
    return (
      <div data-task-panel="full" className="h-full min-h-0">
        {panel}
      </div>
    );
  }

  const background = task.data?.listId ? (
    <LocationPage wsId={wsId} listId={task.data.listId} />
  ) : null;

  if (mode === 'full') {
    return (
      <div data-task-panel="full" className="h-full min-h-0">
        {panel}
      </div>
    );
  }

  if (mode === 'modal') {
    return (
      <div className="relative h-full min-h-0">
        <div className="h-full min-h-0">{background}</div>
        <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <div
          role="dialog"
          aria-label="Detalhes da tarefa"
          data-task-panel="modal"
          className="absolute inset-x-4 inset-y-6 z-50 mx-auto flex max-w-3xl flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
        >
          {panel}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="min-w-0 flex-1 overflow-hidden">{background}</div>

      <div
        role="separator"
        aria-label="Largura do painel da tarefa"
        aria-orientation="vertical"
        aria-valuenow={width}
        aria-valuemin={MIN_PANEL_WIDTH}
        aria-valuemax={MAX_PANEL_WIDTH}
        tabIndex={0}
        className={cn(
          'w-1.5 shrink-0 cursor-col-resize bg-line hover:bg-accent focus-visible:bg-accent',
        )}
        onPointerDown={(event) => {
          event.preventDefault();
          setResizing(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') {
            event.preventDefault();
            resize(width + RESIZE_STEP);
          }

          if (event.key === 'ArrowRight') {
            event.preventDefault();
            resize(width - RESIZE_STEP);
          }
        }}
      />

      <aside
        aria-label="Detalhes da tarefa"
        data-task-panel="side"
        style={{ width: `${String(width)}px` }}
        className="flex h-full min-h-0 shrink-0 flex-col border-l border-line bg-surface"
      >
        {panel}
      </aside>
    </div>
  );
}

export const Route = createFileRoute('/_app/w/$wsId/t/$customId')({
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(treeQuery(params.wsId)),
      context.queryClient.ensureQueryData(workspaceQuery(params.wsId)),
    ]);
  },
  component: Page,
  pendingComponent: PageSkeleton,
});
