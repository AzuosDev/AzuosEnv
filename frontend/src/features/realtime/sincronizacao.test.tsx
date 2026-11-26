import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '@/api/errors';
import { isRealtimeBackedKey } from './use-workspace-realtime';
import { useSincronizacao } from './use-sincronizacao';

const INTERVAL = 30_000;

function Probe({ realtime, sync }: { realtime: boolean; sync: () => Promise<void> }) {
  useSincronizacao({ realtime, sync });

  return null;
}

/** Deixa a aba oculta ou visível para o teste do ciclo. */
function setVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

async function flush(ms: number): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    await Promise.resolve();
  });
}

describe('useSincronizacao', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('com o tempo real de pé não busca nada', async () => {
    const sync = vi.fn(async () => undefined);

    render(<Probe realtime sync={sync} />);
    await flush(INTERVAL * 3);

    expect(sync).not.toHaveBeenCalled();
  });

  it('sem tempo real busca na hora e repete a cada 30 s', async () => {
    const sync = vi.fn(async () => undefined);

    render(<Probe realtime={false} sync={sync} />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(sync).toHaveBeenCalledTimes(1);

    await flush(INTERVAL);
    expect(sync).toHaveBeenCalledTimes(2);

    await flush(INTERVAL);
    expect(sync).toHaveBeenCalledTimes(3);
  });

  it('aba oculta não gasta requisição, e o retorno busca na hora', async () => {
    const sync = vi.fn(async () => undefined);

    render(<Probe realtime={false} sync={sync} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(sync).toHaveBeenCalledTimes(1);

    setVisibility('hidden');
    await flush(INTERVAL * 4);
    expect(sync).toHaveBeenCalledTimes(1);

    setVisibility('visible');
    await act(async () => {
      await Promise.resolve();
    });
    expect(sync).toHaveBeenCalledTimes(2);
  });

  it('erro afasta as tentativas até o teto de 5 minutos', async () => {
    const sync = vi.fn(async () => {
      throw new Error('rede caiu');
    });

    render(<Probe realtime={false} sync={sync} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(sync).toHaveBeenCalledTimes(1);

    // Primeiro erro: a próxima tentativa é em 60 s, não em 30 s.
    await flush(INTERVAL);
    expect(sync).toHaveBeenCalledTimes(1);

    await flush(INTERVAL);
    expect(sync).toHaveBeenCalledTimes(2);

    // Vai dobrando; depois de muitos erros o teto é 5 min.
    await flush(5 * 60_000 * 8);
    expect(sync.mock.calls.length).toBeLessThan(12);
  });

  it('429 com Retry-After manda no prazo da próxima tentativa', async () => {
    const sync = vi.fn(async () => {
      throw new ApiRequestError(
        { statusCode: 429, code: 'TOO_MANY_REQUESTS', message: 'devagar' },
        120_000,
      );
    });

    render(<Probe realtime={false} sync={sync} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(sync).toHaveBeenCalledTimes(1);

    // Antes dos 120 s pedidos, nada.
    await flush(119_000);
    expect(sync).toHaveBeenCalledTimes(1);

    await flush(2_000);
    expect(sync).toHaveBeenCalledTimes(2);
  });

  it('não empilha chamada: a busca presa não deixa outra entrar', async () => {
    let release: (() => void) | null = null;
    const sync = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );

    render(<Probe realtime={false} sync={sync} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(sync).toHaveBeenCalledTimes(1);

    await flush(INTERVAL * 3);
    expect(sync).toHaveBeenCalledTimes(1);

    await act(async () => {
      release?.();
      await Promise.resolve();
    });
    await flush(INTERVAL);
    expect(sync).toHaveBeenCalledTimes(2);
  });

  it('o tempo real voltou: uma busca de acerto e o ciclo para', async () => {
    const sync = vi.fn(async () => undefined);
    const view = render(<Probe realtime={false} sync={sync} />);

    await act(async () => {
      await Promise.resolve();
    });
    expect(sync).toHaveBeenCalledTimes(1);

    view.rerender(<Probe realtime sync={sync} />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(sync).toHaveBeenCalledTimes(2);

    await flush(INTERVAL * 4);
    expect(sync).toHaveBeenCalledTimes(2);
  });
});

describe('isRealtimeBackedKey', () => {
  const ws = 'w1';

  it('pega o que o tempo real manteria em dia', () => {
    expect(isRealtimeBackedKey(['workspaces', ws, 'chat-activity'], ws)).toBe(true);
    expect(isRealtimeBackedKey(['workspaces', ws, 'inbox', 'list', 'primary'], ws)).toBe(true);
    expect(
      isRealtimeBackedKey(['workspaces', ws, 'channels', 'detail', 'c1', 'messages'], ws),
    ).toBe(true);
    expect(isRealtimeBackedKey(['workspaces', ws, 'messages', 'm1', 'replies'], ws)).toBe(true);
    expect(isRealtimeBackedKey(['workspaces', ws, 'tasks', 'query'], ws)).toBe(true);
  });

  it('deixa de fora outro workspace e o que não depende de evento', () => {
    expect(isRealtimeBackedKey(['workspaces', 'outro', 'chat-activity'], ws)).toBe(false);
    expect(isRealtimeBackedKey(['workspaces', ws, 'members'], ws)).toBe(false);
    expect(isRealtimeBackedKey(['session'], ws)).toBe(false);
  });
});
