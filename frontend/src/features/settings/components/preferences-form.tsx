import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Monitor, Moon, Sun } from 'lucide-react';
import { errorMessage } from '@/api/errors';
import type { AuthUser, UserTheme } from '@/api/types';
import { toast } from '@/components/ui/toast';
import { setSession } from '@/features/auth/session';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { updateProfile } from '../api';
import { THEME_OPTIONS } from '../options';
import { SettingsCard } from './settings-card';

const ICONS: Record<UserTheme, typeof Sun> = { dark: Moon, light: Sun, system: Monitor };

/** Tema da interface: vale na hora, fica no localStorage e salva no perfil. */
export function PreferencesForm({ user }: { user: AuthUser }) {
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();

  const save = useMutation({
    mutationFn: (next: UserTheme) => updateProfile({ theme: next }),
    onSuccess: (updated) => {
      setSession(queryClient, updated);
      toast.success('Tema salvo na sua conta.');
    },
    onError: (error: unknown) => {
      // O servidor recusou: volta para o tema que a conta tem.
      setTheme(user.theme);
      toast.error(errorMessage(error));
    },
  });

  const pick = (next: UserTheme): void => {
    setTheme(next);
    save.mutate(next);
  };

  return (
    <SettingsCard
      title="Tema"
      description="Escuro é o padrão. Sistema acompanha o aparelho. A escolha vale em todos os seus dispositivos."
    >
      <div role="radiogroup" aria-label="Tema" className="grid gap-3 sm:grid-cols-3">
        {THEME_OPTIONS.map((option) => {
          const Icon = ICONS[option.value];
          const selected = theme === option.value;

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={save.isPending}
              onClick={() => {
                pick(option.value);
              }}
              className={cn(
                'flex min-h-11 items-center gap-3 rounded-xl border px-3 py-3 text-left text-[13.5px] font-medium',
                selected
                  ? 'border-accent bg-accent/15 text-ink'
                  : 'border-line bg-surface text-body hover:bg-surface-2 hover:text-ink',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {option.label}
            </button>
          );
        })}
      </div>
    </SettingsCard>
  );
}
