import type { LucideIcon } from 'lucide-react';
import { forwardRef, type InputHTMLAttributes } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface IconInputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon: LucideIcon;
}

/** Input com ícone à esquerda, usado nas telas de acesso. */
export const IconInput = forwardRef<HTMLInputElement, IconInputProps>(function IconInput(
  { icon: Icon, className, ...props },
  ref,
) {
  return (
    <div className="relative">
      <Icon
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
      <Input ref={ref} className={cn('pl-10', className)} {...props} />
    </div>
  );
});
