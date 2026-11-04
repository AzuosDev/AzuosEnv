import type { ReactNode } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';

/** Marca da Azuos Env: o bloco </> e o nome. */
export function Brand() {
  return (
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
  );
}

export interface AuthLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Palco das telas públicas: .stage com .dot-grid e o cartão do formulário. */
export function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  return (
    <main className="stage relative flex min-h-dvh w-full flex-col items-center justify-center overflow-hidden px-4 py-10">
      <div className="dot-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="absolute right-3 top-3 z-10">
        <ThemeToggle />
      </div>
      <div className="relative w-full max-w-sm">
        <Brand />
        <section className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-xl sm:p-6">
          <h1 className="heading text-xl">{title}</h1>
          {description ? <p className="mt-2 text-[13px] text-muted">{description}</p> : null}
          <div className="mt-5">{children}</div>
        </section>
        {footer ? <div className="mt-4 text-center text-[13px] text-muted">{footer}</div> : null}
      </div>
    </main>
  );
}
