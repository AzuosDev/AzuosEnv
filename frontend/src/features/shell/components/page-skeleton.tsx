import { Skeleton } from '@/components/ui/skeleton';

/** Carregamento do conteúdo de uma página do workspace. */
export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-4 pt-5 md:px-6">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-48 w-full rounded-2xl" />
    </div>
  );
}
