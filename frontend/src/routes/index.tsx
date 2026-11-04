import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';

function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="btn-signal flex h-10 w-10 items-center justify-center rounded-xl text-[13px] font-bold"
            aria-hidden="true"
          >
            &lt;/&gt;
          </span>
          <div>
            <p className="heading text-lg">Azuos Env</p>
            <p className="text-[13px] text-muted">Sistemas • Automações • Resultados</p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <section className="stage flex flex-col gap-4 rounded-2xl border border-scene-line p-6">
        <StatusPill tone="accent">Etapa F1</StatusPill>
        <h1 className="heading text-2xl">Base do front pronta</h1>
        <p className="max-w-xl text-[13px] text-body">
          Tokens, tema, componentes e cliente da API configurados. As telas entram nas próximas
          etapas.
        </p>
        {import.meta.env.DEV ? (
          <Button asChild variant="ghost" className="w-fit">
            <Link to="/_dev/ui">
              Catálogo de componentes
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        ) : null}
      </section>
    </main>
  );
}

export const Route = createFileRoute('/')({ component: Home });
