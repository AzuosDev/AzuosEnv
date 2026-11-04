import { Toaster as Sonner, toast } from 'sonner';
import { useTheme } from '@/lib/theme';

/** Toasts do app (sonner) pintados com os tokens. */
export function Toaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={resolvedTheme}
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: 'rounded-xl border border-line bg-surface text-ink',
          description: 'text-muted',
          actionButton: 'btn-signal rounded-lg px-2 py-1',
          cancelButton: 'rounded-lg border border-line bg-transparent px-2 py-1 text-body',
        },
      }}
    />
  );
}

export { toast };
