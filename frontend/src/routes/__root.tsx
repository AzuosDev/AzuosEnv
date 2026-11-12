import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { OfflineBanner } from '@/components/offline-banner';
import { RouteError } from '@/components/route-error';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Toaster } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/lib/theme';

interface RouterContext {
  queryClient: QueryClient;
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={200}>
        {children}
        <OfflineBanner />
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}

function RootComponent() {
  return (
    <Shell>
      <Outlet />
    </Shell>
  );
}

function NotFound() {
  return (
    <Shell>
      <main className="mx-auto flex min-h-dvh max-w-2xl items-center px-4">
        <EmptyState
          title="Página não encontrada"
          description="O endereço acessado não existe ou foi movido."
          action={
            <Button asChild variant="ghost">
              <Link to="/">Voltar ao início</Link>
            </Button>
          }
          className="w-full"
        />
      </main>
    </Shell>
  );
}

function RootError({ error, reset }: { error: unknown; reset?: () => void }) {
  return (
    <Shell>
      {/* Fora do shell não existe <main>: o erro da raiz traz o seu. */}
      <main className="flex min-h-dvh items-center">
        <RouteError error={error} reset={reset} />
      </main>
    </Shell>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: RootError,
});
