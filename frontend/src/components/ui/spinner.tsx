import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Spinner({
  className,
  label = 'Carregando',
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span role="status" aria-label={label} className="inline-flex">
      <Loader2 className={cn('h-4 w-4 animate-spin text-accent', className)} aria-hidden="true" />
    </span>
  );
}
