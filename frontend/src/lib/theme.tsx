import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type Theme = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

const STORAGE_KEY = 'azuos-env:theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isTheme(value: unknown): value is Theme {
  return value === 'dark' || value === 'light' || value === 'system';
}

function readStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    return isTheme(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

function matchDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches;
}

export function ThemeProvider({ children }: { children: ReactNode }): ReactNode {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme());
  const [systemDark, setSystemDark] = useState<boolean>(() => matchDark());

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return;
    }

    const query = window.matchMedia(DARK_QUERY);
    const listen = (event: MediaQueryListEvent): void => {
      setSystemDark(event.matches);
    };

    setSystemDark(query.matches);
    query.addEventListener('change', listen);

    return () => {
      query.removeEventListener('change', listen);
    };
  }, []);

  const resolvedTheme: ResolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  const setTheme = useCallback((next: Theme): void => {
    setThemeState(next);

    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Sem localStorage o tema vale só para a sessão.
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme precisa do ThemeProvider.');
  }

  return context;
}

export const THEME_STORAGE_KEY = STORAGE_KEY;
