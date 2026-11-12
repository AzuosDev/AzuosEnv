import { Skeleton } from '@/components/ui/skeleton';

/** Carregamento do painel de uma seção da configuração. */
export function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-2/3" />
    </div>
  );
}
