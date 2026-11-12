import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { useTheme } from '@/lib/theme';
import type { CanvasElement } from '../elements';
import type { BoardScene } from '../hooks/use-board-sync';

/**
 * O Excalidraw só é baixado quando um quadro abre: são centenas de KB que as
 * outras telas não pagam. O CSS vem no mesmo pedaço.
 */
const Canvas = lazy(async () => {
  const [module] = await Promise.all([
    import('@excalidraw/excalidraw'),
    import('@excalidraw/excalidraw/index.css'),
  ]);

  return { default: module.Excalidraw };
});

/** O que a cena precisa do canvas; o resto da API do Excalidraw não é usado. */
interface CanvasApi {
  updateScene: (scene: { elements?: unknown; appState?: Record<string, unknown> }) => void;
}

export interface BoardCanvasProps {
  scene: BoardScene;
  editable: boolean;
  onChange: (elements: readonly CanvasElement[], selectedIds: string[]) => void;
}

/** Valor de um token como cor CSS, para o canvas combinar com os dois temas. */
function token(name: string, fallback: string): string {
  if (typeof window === 'undefined') {
    return fallback;
  }

  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  return value === '' ? fallback : `rgb(${value})`;
}

function appStateFromTokens(): Record<string, unknown> {
  return {
    viewBackgroundColor: token('--paper', 'rgb(11 7 20)'),
    currentItemStrokeColor: token('--accent', 'rgb(167 139 250)'),
    currentItemBackgroundColor: token('--surface-2', 'rgb(28 22 43)'),
    currentItemFontFamily: 2,
  };
}

/** Canvas do quadro: Excalidraw com as cores dos tokens e toque no celular. */
export function BoardCanvas({ scene, editable, onChange }: BoardCanvasProps) {
  const { resolvedTheme } = useTheme();
  const [api, setApi] = useState<CanvasApi | null>(null);
  const applied = useRef(0);
  const initial = useRef(scene.elements);

  useEffect(() => {
    if (!api || scene.epoch === applied.current) {
      return;
    }

    applied.current = scene.epoch;
    api.updateScene({ elements: scene.elements });
  }, [api, scene]);

  useEffect(() => {
    api?.updateScene({ appState: appStateFromTokens() });
  }, [api, resolvedTheme]);

  return (
    <div className="min-h-0 w-full flex-1 touch-pan-y" data-testid="board-canvas">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center">
            <Spinner label="Carregando o quadro" />
          </div>
        }
      >
        <Canvas
          excalidrawAPI={(instance: unknown) => {
            setApi(instance as CanvasApi);
          }}
          theme={resolvedTheme}
          viewModeEnabled={!editable}
          langCode="pt-BR"
          initialData={{
            elements: initial.current as never,
            appState: appStateFromTokens() as never,
            scrollToContent: true,
          }}
          onChange={(elements: readonly unknown[], state: unknown) => {
            const selected = (state as { selectedElementIds?: Record<string, boolean> })
              .selectedElementIds;

            // Antes de a cena do servidor entrar, o canvas está vazio: avisar
            // mudança agora apagaria o quadro de quem abriu junto.
            if (applied.current !== scene.epoch) {
              return;
            }

            onChange(
              elements as readonly CanvasElement[],
              Object.keys(selected ?? {}).filter((id) => selected?.[id] === true),
            );
          }}
        />
      </Suspense>
    </div>
  );
}
