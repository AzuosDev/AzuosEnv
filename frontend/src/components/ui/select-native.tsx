import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Select nativo com a cara dos tokens. Fica no lugar do Select do Radix quando a
 * escolha é uma lista simples: o label nativo liga direto e o celular abre o
 * seletor do sistema.
 */
export const SelectNative = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function SelectNative({ className, children, ...props }, ref) {
    return (
      <span className="relative flex w-full items-center">
        <select
          ref={ref}
          className={cn(
            'h-11 w-full appearance-none rounded-xl border border-line bg-surface pl-3 pr-9 text-ink outline-none disabled:opacity-45 md:h-10',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 h-4 w-4 text-muted"
          aria-hidden="true"
        />
      </span>
    );
  },
);
