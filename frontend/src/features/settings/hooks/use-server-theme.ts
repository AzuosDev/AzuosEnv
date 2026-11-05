import { useEffect, useRef } from 'react';
import type { AuthUser } from '@/api/types';
import { useTheme } from '@/lib/theme';

/**
 * No login o tema do perfil vence o que está no localStorage: a conta manda, e
 * uma troca feita depois (ThemeToggle ou Preferências) continua valendo.
 */
export function useServerTheme(user: AuthUser | null): void {
  const { setTheme } = useTheme();
  const applied = useRef<string | null>(null);

  useEffect(() => {
    if (!user || applied.current === user.id) {
      return;
    }

    applied.current = user.id;
    setTheme(user.theme);
  }, [user, setTheme]);
}
