import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { THEME_STORAGE_KEY, ThemeProvider, useTheme } from '@/lib/theme';

type Listener = (event: MediaQueryListEvent) => void;

interface FakeMedia {
  setSystemDark: (dark: boolean) => void;
}

/** matchMedia controlável, para simular a preferência do sistema operacional. */
function mockMatchMedia(initialDark: boolean): FakeMedia {
  let dark = initialDark;
  const listeners = new Set<Listener>();

  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('dark') ? dark : false,
      media: query,
      onchange: null,
      addEventListener: (_: string, listener: Listener) => listeners.add(listener),
      removeEventListener: (_: string, listener: Listener) => listeners.delete(listener),
      addListener: (listener: Listener) => listeners.add(listener),
      removeListener: (listener: Listener) => listeners.delete(listener),
      dispatchEvent: () => false,
    })),
  );

  return {
    setSystemDark(next: boolean) {
      dark = next;
      act(() => {
        listeners.forEach((listener) => {
          listener({ matches: next } as MediaQueryListEvent);
        });
      });
    },
  };
}

function Probe() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <button type="button" onClick={() => setTheme('light')}>
        claro
      </button>
    </div>
  );
}

function renderProbe() {
  return render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ThemeProvider', () => {
  it('em system segue o tema do sistema operacional', () => {
    const media = mockMatchMedia(true);

    renderProbe();

    expect(screen.getByTestId('theme')).toHaveTextContent('system');
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');

    media.setSystemDark(false);

    expect(screen.getByTestId('resolved')).toHaveTextContent('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('a escolha manual vence o sistema e fica salva', async () => {
    const media = mockMatchMedia(true);

    renderProbe();
    await userEvent.click(screen.getByRole('button', { name: 'claro' }));

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');

    media.setSystemDark(true);

    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('lê o tema salvo no localStorage', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    mockMatchMedia(false);

    renderProbe();

    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
