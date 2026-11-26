import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  clampWidth,
  readPanel,
  widthFromDrag,
  writePanel,
  type PanelLimits,
  type PanelSide,
  type PanelState,
} from '@/lib/panel-store';
import { cn } from '@/lib/utils';

export interface UsePanelSizeOptions {
  /** Chave no localStorage, estável entre sessões. */
  id: string;
  /** Nome da barra em minúsculas, com artigo: "a navegação do workspace". */
  label: string;
  side?: PanelSide;
  defaultWidth: number;
  min?: number;
  max?: number;
}

export interface PanelSize {
  label: string;
  side: PanelSide;
  limits: PanelLimits;
  /** Largura atual em px; vale só quando a barra está visível. */
  width: number;
  collapsed: boolean;
  setWidth: (width: number) => void;
  /** Soma px à largura, respeitando o lado e os limites. */
  nudge: (delta: number) => void;
  toggle: () => void;
  reset: () => void;
}

const STEP = 16;
const BIG_STEP = 48;

/**
 * Largura e visibilidade de uma barra lateral, lembradas no localStorage. A
 * barra continua sendo desenhada pela tela: o hook só guarda a medida e o
 * `PanelResizer` dá a alça de arraste.
 */
export function usePanelSize({
  id,
  label,
  side = 'left',
  defaultWidth,
  min = 200,
  max = 480,
}: UsePanelSizeOptions): PanelSize {
  const limits = useMemo<PanelLimits>(() => ({ defaultWidth, min, max }), [defaultWidth, min, max]);
  const [state, setState] = useState<PanelState>(() => readPanel(id, limits));

  // Grava depois de o arraste parar: um setItem por quadro não vale o disco.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      writePanel(id, state);
    }, 150);

    return () => {
      window.clearTimeout(timer);
    };
  }, [id, state]);

  const setWidth = useCallback(
    (width: number) => {
      setState((current) => {
        const next = clampWidth(width, limits);

        return current.width === next ? current : { ...current, width: next };
      });
    },
    [limits],
  );

  const nudge = useCallback(
    (delta: number) => {
      setState((current) => {
        const next = clampWidth(current.width + (side === 'left' ? delta : -delta), limits);

        return current.width === next ? current : { ...current, width: next };
      });
    },
    [limits, side],
  );

  const toggle = useCallback(() => {
    setState((current) => ({ ...current, collapsed: !current.collapsed }));
  }, []);

  const reset = useCallback(() => {
    setState({ width: limits.defaultWidth, collapsed: false });
  }, [limits]);

  return useMemo(
    () => ({
      label,
      side,
      limits,
      width: state.width,
      collapsed: state.collapsed,
      setWidth,
      nudge,
      toggle,
      reset,
    }),
    [label, side, limits, state.width, state.collapsed, setWidth, nudge, toggle, reset],
  );
}

export interface PanelResizerProps {
  panel: PanelSize;
  /** Paleta do trilho: `wa` troca os tokens pelos da Central do WhatsApp. */
  tone?: 'default' | 'wa';
  className?: string;
}

const TONE = {
  default: {
    active: 'after:bg-accent',
    hover: 'hover:after:bg-accent focus-visible:after:bg-accent',
    button: 'border-line bg-surface-2 text-muted hover:text-ink',
  },
  wa: {
    active: 'after:bg-wa-accent',
    hover: 'hover:after:bg-wa-accent focus-visible:after:bg-wa-accent',
    button: 'border-wa-line bg-wa-header text-wa-muted hover:text-wa-text',
  },
} as const;

/**
 * Alça entre a barra lateral e o conteúdo: arraste para medir, clique duplo
 * para voltar ao padrão, Enter ou o botão para ocultar e mostrar. Só existe a
 * partir de 1024 px, onde a barra está no fluxo (abaixo disso ela é drawer).
 * Ocupa largura zero: a alça fica em cima da borda, sem mexer no layout.
 */
export function PanelResizer({ panel, tone = 'default', className }: PanelResizerProps) {
  const { side, width, collapsed, limits, setWidth, nudge, toggle, reset, label } = panel;
  const [dragging, setDragging] = useState(false);
  const start = useRef({ x: 0, width });
  const tokens = TONE[tone];
  const open = !collapsed;

  useEffect(() => {
    if (!dragging) {
      return undefined;
    }

    const onMove = (event: PointerEvent): void => {
      setWidth(widthFromDrag(start.current.width, event.clientX - start.current.x, side, limits));
    };
    const onEnd = (): void => {
      setDragging(false);
    };

    // Cursor e bloqueio de seleção vão no documento: o ponteiro sai da alça.
    const previous = document.body.style.cursor;

    document.body.style.cursor = 'col-resize';
    document.body.classList.add('select-none');
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);

    return () => {
      document.body.style.cursor = previous;
      document.body.classList.remove('select-none');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
  }, [dragging, limits, side, setWidth]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const step = event.shiftKey ? BIG_STEP : STEP;

    if (event.key === 'Enter' || event.key === ' ') {
      toggle();
    } else if (collapsed) {
      return;
    } else if (event.key === 'ArrowRight') {
      nudge(step);
    } else if (event.key === 'ArrowLeft') {
      nudge(-step);
    } else if (event.key === 'Home') {
      setWidth(side === 'left' ? limits.min : limits.max);
    } else if (event.key === 'End') {
      setWidth(side === 'left' ? limits.max : limits.min);
    } else {
      return;
    }

    event.preventDefault();
  };

  return (
    <div className={cn('relative z-20 hidden w-0 shrink-0 lg:block', className)}>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={`Redimensionar ${label}`}
        aria-valuenow={collapsed ? 0 : width}
        aria-valuemin={limits.min}
        aria-valuemax={limits.max}
        aria-valuetext={collapsed ? 'Oculta' : `${String(width)} pixels`}
        tabIndex={0}
        onPointerDown={(event) => {
          if (event.button !== 0 || collapsed) {
            return;
          }

          start.current = { x: event.clientX, width };
          setDragging(true);
        }}
        onDoubleClick={reset}
        onKeyDown={onKeyDown}
        className={cn(
          'peer absolute inset-y-0 -left-1 w-2 outline-none',
          /* A linha de 1 px acende em cima da borda da barra. */
          'after:absolute after:inset-y-0 after:left-1 after:w-px after:bg-transparent after:transition-colors',
          open && ['cursor-col-resize', tokens.hover],
          open && dragging && tokens.active,
        )}
      />

      <button
        type="button"
        onClick={toggle}
        aria-label={`${collapsed ? 'Mostrar' : 'Ocultar'} ${label}`}
        title={`${collapsed ? 'Mostrar' : 'Ocultar'} ${label}`}
        className={cn(
          /* No topo, e não no meio: a alça inteira fica livre para o arraste
             em vez de ter o botão plantado justo onde a mão pega. */
          'absolute top-3 flex h-11 w-6 items-center justify-center rounded-lg border transition-opacity',
          tokens.button,
          collapsed && (side === 'left' ? 'left-1' : 'right-1'),
          open &&
            'left-0 -translate-x-1/2 opacity-0 hover:opacity-100 focus-visible:opacity-100 peer-hover:opacity-100 peer-focus-visible:opacity-100',
        )}
      >
        {(side === 'left') === collapsed ? (
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
