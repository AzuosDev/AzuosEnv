import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { cn } from '@/lib/utils';

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetTitle = DialogPrimitive.Title;
export const SheetDescription = DialogPrimitive.Description;

type Side = 'left' | 'right' | 'bottom';

const sideClass: Record<Side, string> = {
  left: 'inset-y-0 left-0 w-[88vw] max-w-sm border-r',
  right: 'inset-y-0 right-0 w-[88vw] max-w-sm border-l',
  bottom: 'inset-x-0 bottom-0 max-h-[90dvh] rounded-t-2xl border-t',
};

export interface SheetContentProps extends ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
> {
  side?: Side;
}

/** Drawer lateral (a sidebar abaixo de 1024 px) ou inferior. */
export const SheetContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(function SheetContent({ className, children, side = 'left', ...props }, ref) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed z-50 flex flex-col gap-4 overflow-y-auto border-line bg-paper-2 p-4',
          sideClass[side],
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label="Fechar"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});
