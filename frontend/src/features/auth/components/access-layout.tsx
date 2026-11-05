import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';
import { AuthShowcase } from '@/features/auth/components/auth-showcase';

/** Marca em uma linha, no topo das telas de acesso. */
function BrandMark() {
  return (
    <Link to="/" className="flex w-fit items-center gap-2 rounded-xl">
      <span
        className="btn-signal grid h-9 w-9 place-items-center rounded-xl text-[11px] font-bold"
        aria-hidden="true"
      >
        &lt;/&gt;
      </span>
      <span className="text-lg font-bold tracking-tight text-ink">Azuos Env</span>
    </Link>
  );
}

export interface AccessLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Telas de acesso (login, cadastro e convite): coluna do formulário à esquerda
 * e, a partir de 1024 px, o painel de apresentação à direita.
 */
export function AccessLayout({ title, description, children, footer }: AccessLayoutProps) {
  return (
    <div className="min-h-dvh bg-paper lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
      <div className="flex min-h-dvh flex-col px-5 py-6 sm:px-10 lg:px-14">
        <div className="flex items-center justify-between gap-4">
          <BrandMark />
          <ThemeToggle />
        </div>

        <main className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-[400px] py-10">
            <header className="mb-8">
              <h1 className="heading text-balance text-[1.875rem] leading-tight">{title}</h1>
              {description ? <p className="mt-2 text-sm text-muted">{description}</p> : null}
            </header>

            {children}

            {footer ? <div className="mt-8 text-center text-sm text-muted">{footer}</div> : null}
          </div>
        </main>
      </div>

      <AuthShowcase />
    </div>
  );
}
