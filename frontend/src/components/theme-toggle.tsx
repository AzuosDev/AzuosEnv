import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type Theme } from '@/lib/theme';
import { cn } from '@/lib/utils';

const options: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'dark', label: 'Escuro', icon: Moon },
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'system', label: 'Sistema', icon: Monitor },
];

/**
 * Troca entre escuro, claro e o tema do sistema. `touch` sobe os botões para
 * 44 px no celular (alvo de toque das telas de acesso, como no protótipo).
 */
export function ThemeToggle({ className, touch }: { className?: string; touch?: boolean }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="group"
      aria-label="Tema"
      className={cn('inline-flex items-center gap-1 rounded-xl border border-line p-1', className)}
    >
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          aria-label={label}
          aria-pressed={theme === value}
          data-theme-option={value}
          onClick={() => {
            setTheme(value);
          }}
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink',
            touch && 'h-11 w-11 md:h-10 md:w-10',
            theme === value && 'bg-surface-2 text-ink',
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
