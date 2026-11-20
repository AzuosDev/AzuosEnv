/**
 * Ilustração das telas de acesso: um monitor de vidro com um quadro em
 * movimento, mais dois widgets flutuantes. Todo o conteúdo é fictício e
 * decorativo — o bloco é `aria-hidden` e não tem nenhum controle. Só é
 * carregada a partir de 1100 px (import dinâmico no AuthGlassLayout).
 */

const COLUMN_TITLE = 'flex h-[18px] items-center gap-1.5 text-[12px] font-semibold text-body';
const DOT = 'h-[7px] w-[7px] rounded-full';
const AVATAR =
  'inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface text-[9.5px] font-bold';

export default function AuthIllustration() {
  return (
    <div className="auth-art-box" aria-hidden="true" data-testid="auth-illustration">
      {/* Monitor */}
      <div className="auth-piece auth-monitor glass-blur glass-sheen auth-delay-1 left-1.5 top-10 flex h-[356px] w-[568px] flex-col gap-3 rounded-[18px] p-3.5">
        <div className="flex items-center gap-[7px] px-1">
          <span className="h-2.5 w-2.5 rounded-full bg-danger/85" />
          <span className="h-2.5 w-2.5 rounded-full bg-warning/85" />
          <span className="h-2.5 w-2.5 rounded-full bg-success/85" />
          <span className="ml-2 text-[13px] font-semibold text-ink">
            App Vitrine Aurora — Sprint 4
          </span>
          <span className="ml-auto flex items-center gap-2">
            <span className="flex">
              <span className={`${AVATAR} bg-accent text-on-signal`}>LA</span>
              <span className={`${AVATAR} -ml-[7px] bg-info text-paper`}>MC</span>
            </span>
            <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full bg-success/15 px-2.5 text-[11px] font-semibold text-ink">
              <span className="auth-live h-[7px] w-[7px] rounded-full bg-success" />
              Ao vivo
            </span>
          </span>
        </div>

        <div className="auth-screen relative flex-1 p-3.5">
          <div className="grid grid-cols-3 gap-3">
            <div className="flex min-w-0 flex-col gap-2">
              <span className={COLUMN_TITLE}>
                <span className={`${DOT} bg-muted`} />A fazer
                <span className="ml-auto font-medium text-muted">2</span>
              </span>
              <div className="auth-mini h-[50px] px-2.5 py-2 text-ink">
                <span className="text-muted">AZD-214</span>
                <br />
                Catálogo de produtos
              </div>
              <div className="h-[50px] rounded-[10px] border border-dashed border-ink/15" />
              <div className="auth-mini h-[50px] px-2.5 py-2 text-ink">
                <span className="text-muted">AZD-221</span>
                <br />
                Banner de Natal
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-2">
              <span className={COLUMN_TITLE}>
                <span className={`${DOT} bg-info`} />
                Em andamento
                <span className="ml-auto font-medium text-muted">2</span>
              </span>
              <div className="auth-mini h-[50px] border-accent/50 bg-accent/15 px-2.5 py-2 text-ink">
                <span className="text-muted">AZD-212</span>
                <br />
                Checkout por Pix
              </div>
              <div className="-mt-1 h-1 overflow-hidden rounded-full bg-ink/10">
                <div className="auth-fill h-1 w-full rounded-full bg-accent" />
              </div>
              <div className="auth-mini h-[50px] px-2.5 py-2 text-ink">
                <span className="font-semibold text-danger">Urgente</span>
                <br />
                Frete grátis quebrado
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-2">
              <span className={COLUMN_TITLE}>
                <span className={`${DOT} bg-success`} />
                Concluído
                <span className="ml-auto font-medium text-muted">1</span>
              </span>
              <div className="auth-mini h-[50px] px-2.5 py-2 text-muted">
                <span>AZD-207</span>
                <br />
                <span className="line-through">Login com e-mail</span>
              </div>
            </div>
          </div>

          {/* O cartão que a Lia arrasta de "A fazer" para "Concluído". */}
          <div className="auth-mini auth-mover left-3.5 top-[98px] z-[2] h-[50px] w-[calc((100%-52px)/3)] px-2.5 py-2 text-ink">
            <span className="text-muted">AZD-219</span>
            <br />
            Cupons de desconto
            <span className="auth-cursor absolute -bottom-[26px] -right-[18px] flex items-start gap-0.5">
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path
                  d="M4 3l16 8-7 2-3 7z"
                  fill="rgb(var(--accent))"
                  stroke="rgb(var(--surface))"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="mt-3 whitespace-nowrap rounded-md bg-accent px-[7px] py-0.5 text-[10.5px] font-semibold text-on-signal">
                Lia
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Pé e base do monitor */}
      <div className="auth-piece auth-delay-1 left-[281px] top-[396px] h-10 w-[18px] rounded-b bg-gradient-to-b from-ink/20 to-ink/10" />
      <div className="auth-piece glass auth-delay-1 left-[190px] top-[434px] h-3 w-[200px] rounded-full" />

      {/* Widget do Burndown */}
      <div className="auth-piece glass auth-delay-2 -right-1.5 top-0 w-[210px] rounded-[18px] px-4 py-3.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[12.5px] font-semibold text-ink">Burndown</span>
          <span className="text-[11.5px] text-muted">7 de 8 abertas</span>
        </div>
        <svg width="178" height="70" viewBox="0 0 178 70" className="mt-2.5 block">
          <path
            d="M2 8 L176 64"
            stroke="rgb(var(--ink) / 0.3)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            fill="none"
          />
          <polyline
            points="2,8 32,9 62,20 92,23 122,36 150,40"
            stroke="rgb(var(--accent))"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <circle cx="150" cy="40" r="4" fill="rgb(var(--accent))" />
        </svg>
      </div>

      {/* Widget "Hoje" */}
      <div className="auth-piece glass auth-delay-3 -left-2.5 bottom-1.5 flex w-[230px] flex-col gap-[9px] rounded-[18px] px-4 py-3.5">
        <span className="text-[12.5px] font-semibold text-ink">Hoje</span>
        <span className="flex items-center gap-2 text-[12px] text-muted">
          <span className="inline-flex h-[15px] w-[15px] items-center justify-center rounded-[5px] bg-success">
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgb(var(--surface))"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
          <span className="line-through">Revisar PR do checkout</span>
        </span>
        <span className="flex items-center gap-2 text-[12px] text-body">
          <span className="h-[13px] w-[13px] rounded-[5px] border-[1.5px] border-ink/35" />
          Reunião com Café Horizonte
        </span>
        <span className="flex items-center gap-2 text-[12px] text-body">
          <span className="h-[13px] w-[13px] rounded-[5px] border-[1.5px] border-ink/35" />
          Proposta para Ótica Lumen
        </span>
      </div>
    </div>
  );
}
