import { Eye, EyeOff } from 'lucide-react';
import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Campo do cartão de vidro: label nativo e o input translúcido. */
export function GlassField({
  id,
  label,
  children,
  hint,
}: {
  id: string;
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[14px] font-medium text-ink">
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-[12px] text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const GlassInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function GlassInput({ className, type = 'text', ...props }, ref) {
    return <input ref={ref} type={type} className={cn('gfield', className)} {...props} />;
  },
);

/** Senha do cartão, com mostrar/ocultar em alvo de 44 px. */
export const GlassPasswordInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function GlassPasswordInput({ className, ...props }, ref) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;

  return (
    <div className="relative">
      <input
        ref={ref}
        type={visible ? 'text' : 'password'}
        className={cn('gfield pr-[52px]', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => {
          setVisible((current) => !current);
        }}
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visible}
        className="absolute right-[3px] top-[3px] flex h-11 w-11 items-center justify-center rounded-[10px] text-muted hover:text-ink"
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
});

/**
 * Linha de erro do formulário: espaço reservado para não empurrar o botão
 * quando a mensagem aparece. Os campos apontam para ela por aria-describedby.
 */
export function GlassFormError({ id, children }: { id: string; children?: ReactNode }) {
  return (
    <div className="min-h-[20px]">
      {children ? (
        <p id={id} role="alert" className="m-0 text-[14px] text-danger">
          {children}
        </p>
      ) : null}
    </div>
  );
}

/** Divisor "ou" entre o formulário e o acesso com o Google. */
export function GlassDivider({ label = 'ou' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3.5 text-[13.5px] text-muted" aria-hidden="true">
      <span className="h-px flex-1 bg-ink/15" />
      {label}
      <span className="h-px flex-1 bg-ink/15" />
    </div>
  );
}

/** Classe do botão principal do cartão (uma ação em gradiente por tela). */
export const GLASS_SUBMIT = 'h-[52px] w-full rounded-[14px] text-[15.5px] font-semibold';

/** Classe dos botões secundários de vidro do cartão. */
export const GLASS_SECONDARY = 'h-12 w-full rounded-[14px] font-medium';
