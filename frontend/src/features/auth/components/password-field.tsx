import { Eye, EyeOff, type LucideIcon } from 'lucide-react';
import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface PasswordFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: LucideIcon;
}

/** Senha com botão de mostrar/ocultar (alvo de toque de 44 px). */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField({ className, icon: Icon, ...props }, ref) {
    const [visible, setVisible] = useState(false);
    const Toggle = visible ? EyeOff : Eye;

    return (
      <div className="relative">
        {Icon ? (
          <Icon
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
        ) : null}
        <Input
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={cn('pr-12', Icon && 'pl-10', className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => {
            setVisible((current) => !current);
          }}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-xl text-muted hover:text-ink md:h-10 md:w-10"
        >
          <Toggle className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    );
  },
);
