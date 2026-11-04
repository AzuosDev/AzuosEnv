import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, type = 'text', ...props }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          'h-11 w-full rounded-xl border border-line bg-surface px-3 text-ink outline-none placeholder:text-muted disabled:opacity-45 md:h-10',
          className,
        )}
        {...props}
      />
    );
  },
);
