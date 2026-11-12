import * as SwitchPrimitive from '@radix-ui/react-switch';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { cn } from '@/lib/utils';

export const Switch = forwardRef<
  ElementRef<typeof SwitchPrimitive.Root>,
  ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(function Switch({ className, ...props }, ref) {
  return (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-line bg-surface-2 transition-colors data-[state=checked]:border-accent data-[state=checked]:bg-accent',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block h-4 w-4 translate-x-1 rounded-full bg-ink transition-transform data-[state=checked]:translate-x-6 data-[state=checked]:bg-on-signal" />
    </SwitchPrimitive.Root>
  );
});
