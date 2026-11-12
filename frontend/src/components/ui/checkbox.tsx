import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { cn } from '@/lib/utils';

export const Checkbox = forwardRef<
  ElementRef<typeof CheckboxPrimitive.Root>,
  ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(function Checkbox({ className, ...props }, ref) {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        // O quadrado tem 20 px, mas o alvo de toque chega a 44 px pelo ::before.
        'relative flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border border-line bg-surface before:absolute before:-inset-3 before:content-[""] data-[state=checked]:border-accent data-[state=checked]:bg-accent md:before:-inset-1',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <Check className="h-3.5 w-3.5 text-on-signal" aria-hidden="true" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});
