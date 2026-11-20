import { Link } from '@tanstack/react-router';
import { lazy, Suspense, type ReactNode } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';
import { useMinWidth } from '@/lib/use-min-width';

/** Largura a partir da qual a ilustração existe (e só então é baixada). */
export const ILLUSTRATION_MIN_WIDTH = 1100;

const AuthIllustration = lazy(() => import('./auth-illustration'));

/** Marca do topo: o glifo do código, o nome do sistema e quem o faz. */
function BrandMark() {
  return (
    <Link to="/" className="flex w-fit items-center gap-2.5 rounded-xl">
      <span
        className="btn-signal flex h-10 w-10 items-center justify-center rounded-xl text-[13px] font-bold shadow-none"
        aria-hidden="true"
      >
        &lt;/&gt;
      </span>
      <span className="flex flex-col leading-[1.15]">
        <span className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Azuos Env</span>
        <span className="text-[12px] text-muted">por Azuos Dev</span>
      </span>
    </Link>
  );
}

/** Título do cartão: nome da tela, traço em accent e a frase de boas-vindas. */
export function AuthCardTitle({ title, greeting }: { title: string; greeting?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3.5">
      <h1 className="m-0 text-[32px] font-semibold leading-none tracking-[-0.035em] text-ink sm:text-[40px]">
        {title}
      </h1>
      <span aria-hidden="true" className="h-[3px] w-16 rounded-full bg-accent" />
      {greeting ? <p className="m-0 text-[17px] text-body">{greeting}</p> : null}
    </div>
  );
}

export interface AuthGlassLayoutProps {
  /** Rótulo do cartão para leitor de tela. */
  label?: string;
  children: ReactNode;
}

/**
 * Casca das telas de acesso: a cena da Azuos em tela cheia, a ilustração do
 * quadro à esquerda (só a partir de 1100 px, em chunk próprio) e o cartão de
 * vidro à direita. Nenhuma lógica de sessão vive aqui.
 */
export function AuthGlassLayout({ label = 'Acesso ao Azuos Env', children }: AuthGlassLayoutProps) {
  const wide = useMinWidth(ILLUSTRATION_MIN_WIDTH);

  return (
    <div className="auth-scene stage">
      <div className="dot-grid absolute inset-0 opacity-35" aria-hidden="true" />

      <div
        className="auth-glow auth-glow-accent left-[6%] top-[14%] h-[460px] w-[460px]"
        aria-hidden="true"
      />
      <div
        className="auth-glow auth-glow-signal -bottom-20 right-[18%] h-80 w-80"
        aria-hidden="true"
      />
      <div className="auth-glow auth-glow-scene right-[4%] top-[6%] h-60 w-60" aria-hidden="true" />

      <div
        className="auth-ring -right-[120px] -top-[150px] h-[380px] w-[380px]"
        aria-hidden="true"
      />
      <div className="auth-ring -bottom-[130px] left-[47%] h-60 w-60" aria-hidden="true" />
      <div
        className="auth-ring -top-[60px] left-[34%] h-[120px] w-[120px] border-transparent bg-ink/5"
        aria-hidden="true"
      />
      <div className="auth-ring -left-[70px] -top-[90px] h-[210px] w-[300px]" aria-hidden="true" />

      <header className="absolute inset-x-0 top-0 z-[3] flex items-center justify-between gap-4 px-4 py-[22px] sm:px-[clamp(16px,4vw,48px)] sm:py-7">
        <BrandMark />
        <ThemeToggle className="gbtn" touch />
      </header>

      <main className="relative z-[1] flex min-h-dvh items-start justify-center px-3.5 pb-7 pt-[92px] sm:items-center sm:gap-[clamp(32px,5vw,80px)] sm:px-[clamp(16px,5vw,80px)] sm:pb-14 sm:pt-[110px]">
        {wide ? (
          <div className="hidden min-w-0 max-w-[640px] flex-1 justify-center min-[1100px]:flex">
            <Suspense fallback={null}>
              <AuthIllustration />
            </Suspense>
          </div>
        ) : null}

        <section
          aria-label={label}
          className="glass glass-blur auth-rise w-full max-w-[440px] rounded-3xl p-[32px_22px_28px] sm:w-[440px] sm:flex-none sm:rounded-[28px] sm:p-[44px_40px_36px]"
        >
          {children}
        </section>
      </main>
    </div>
  );
}
