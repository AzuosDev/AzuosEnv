import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-colors disabled:pointer-events-none disabled:opacity-45',
  {
    variants: {
      variant: {
        signal: 'btn-signal hover:brightness-110',
        ghost: 'border border-line bg-transparent text-body hover:bg-surface-2 hover:text-ink',
        outline: 'border border-scene-line bg-surface text-ink hover:bg-surface-2',
        danger: 'border-0 bg-danger text-white hover:brightness-110',
        nav: 'border-0 bg-transparent text-muted hover:bg-surface-2 hover:text-ink',
      },
      size: {
        sm: 'h-11 px-3 text-[13px] md:h-9',
        md: 'h-11 px-4 md:h-10',
        lg: 'h-12 px-6',
        icon: 'h-11 w-11 p-0 md:h-10 md:w-10',
      },
    },
    defaultVariants: { variant: 'signal', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, type = 'button', ...props },
  ref,
) {
  const Component = asChild ? Slot : 'button';

  return (
    <Component
      ref={ref}
      type={asChild ? undefined : type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
});

export { buttonVariants };
