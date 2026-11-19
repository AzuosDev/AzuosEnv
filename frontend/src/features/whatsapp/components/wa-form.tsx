import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Peças de formulário da Central. Existem porque as cinco abas da F20 repetem
 * o mesmo cartão, o mesmo campo e a mesma bolha de prévia, e tudo isso vive na
 * paleta do módulo (`--wa-*`), não nos tokens violeta do app.
 */

/** Campo de uma linha: altura de toque, fundo do cabeçalho, borda do módulo. */
export const waInputClass =
  'h-11 w-full min-w-0 rounded-xl border border-wa-line bg-wa-header px-3 text-[14px] text-wa-text outline-none placeholder:text-wa-muted focus-visible:border-wa-accent disabled:opacity-45 md:h-10';

/** Área de texto com a mesma pele do campo. */
export const waTextareaClass =
  'w-full min-w-0 resize-y rounded-xl border border-wa-line bg-wa-header px-3 py-2.5 text-[14px] leading-snug text-wa-text outline-none placeholder:text-wa-muted focus-visible:border-wa-accent disabled:opacity-45';

/** Ação principal da aba. Uma por tela, como manda o sinal raro. */
export const waPrimaryClass =
  'flex h-11 items-center justify-center gap-2 rounded-xl bg-wa-accent px-4 text-[14px] font-semibold text-wa-panel disabled:opacity-45 md:h-10';

/** Ação secundária: contorno na linha do módulo. */
export const waGhostClass =
  'flex h-11 items-center justify-center gap-2 rounded-xl border border-wa-line px-4 text-[14px] font-semibold text-wa-text hover:bg-wa-header disabled:opacity-45 md:h-10';

/** Botão só de ícone; sempre com aria-label em quem usa. */
export const waIconClass =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-wa-line text-wa-text hover:bg-wa-header disabled:opacity-45 md:h-10 md:w-10';

export interface WaCardProps {
  title: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Placa de conteúdo da Central: título, apoio e corpo. */
export function WaCard({ title, hint, action, children, className }: WaCardProps) {
  return (
    <section className={cn('rounded-2xl border border-wa-line bg-wa-panel p-4 md:p-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-wa-text">{title}</h2>
          {hint ? <p className="mt-1 text-[13px] text-wa-muted">{hint}</p> : null}
        </div>
        {action}
      </div>

      <div className="mt-4 flex flex-col gap-3">{children}</div>
    </section>
  );
}

export interface WaFieldProps {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}

/** Rótulo nativo ligado ao controle, com apoio embaixo. */
export function WaField({ label, hint, children, className }: WaFieldProps) {
  return (
    <label className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <span className="text-[13px] font-medium text-wa-text">{label}</span>
      {children}
      {hint ? <span className="text-[12px] text-wa-muted">{hint}</span> : null}
    </label>
  );
}

export interface WaToggleProps {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}

/**
 * Liga e desliga na paleta do módulo. O Switch do app é violeta e brigaria com
 * o verde da Central, então aqui o controle é um `checkbox` com aparência.
 */
export function WaToggle({ label, hint, checked, disabled = false, onChange }: WaToggleProps) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[13px] font-medium text-wa-text">{label}</span>
        {hint ? <span className="text-[12px] text-wa-muted">{hint}</span> : null}
      </span>

      <span className="relative inline-flex shrink-0">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => {
            onChange(event.target.checked);
          }}
          className="peer h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full border border-wa-line bg-wa-header transition-colors checked:border-wa-accent checked:bg-wa-accent disabled:opacity-45"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-wa-panel transition-transform peer-checked:translate-x-5"
        />
      </span>
    </label>
  );
}

export interface WaBubbleProps {
  /** Texto já com as variáveis resolvidas; vazio mostra o aviso. */
  text: string;
  /** Rodapé e cabeçalho da resposta interativa. */
  header?: string;
  footer?: string;
  /** Botões ou linhas da lista, na ordem configurada. */
  options?: { id: string; title: string; description?: string }[];
  /** Rótulo que abre a lista interativa. */
  buttonLabel?: string;
  kind?: 'text' | 'media' | 'buttons' | 'list' | 'none';
  filename?: string;
  time?: string;
}

/**
 * Bolha de saída como o cliente vê: a mesma cor, o mesmo rabicho e os mesmos
 * blocos de botão e lista que a Cloud API desenha no aparelho.
 */
export function WaBubble({
  text,
  header,
  footer,
  options = [],
  buttonLabel,
  kind = 'text',
  filename,
  time = '12:00',
}: WaBubbleProps) {
  const empty = text.trim() === '' && options.length === 0 && !filename;

  return (
    <div className="flex justify-end">
      <div className="wa-tail-out relative max-w-[min(85%,22rem)] rounded-lg rounded-tr-none bg-wa-out px-2.5 py-1.5 text-[14px] leading-snug text-wa-text">
        {header ? <p className="text-[13px] font-semibold text-wa-text">{header}</p> : null}

        {kind === 'media' && filename ? (
          <p className="mb-1 flex items-center gap-1.5 rounded-md bg-wa-quote-out px-2 py-1.5 text-[13px] text-wa-text">
            <span className="truncate">{filename}</span>
          </p>
        ) : null}

        {empty ? (
          <p className="text-[13px] italic text-wa-muted">Escreva a mensagem para ver a prévia.</p>
        ) : (
          <p className="whitespace-pre-wrap break-words">{text}</p>
        )}

        {footer ? <p className="mt-1 text-[12px] text-wa-muted">{footer}</p> : null}

        <span className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-wa-muted">
          {time}
          <span aria-hidden="true" className="text-wa-read">
            ✓✓
          </span>
        </span>

        {kind === 'buttons' && options.length > 0 ? (
          <span className="mt-1.5 flex flex-col gap-1">
            {options.map((option) => (
              <span
                key={option.id}
                className="flex min-h-9 items-center justify-center rounded-md border border-wa-line bg-wa-panel px-2 text-center text-[13px] font-semibold text-wa-accent"
              >
                {option.title}
              </span>
            ))}
          </span>
        ) : null}

        {kind === 'list' && options.length > 0 ? (
          <span className="mt-1.5 flex flex-col gap-1">
            <span className="flex min-h-9 items-center justify-center rounded-md border border-wa-line bg-wa-panel px-2 text-[13px] font-semibold text-wa-accent">
              {buttonLabel ?? 'Ver opções'}
            </span>
            <span className="flex flex-col gap-0.5 rounded-md bg-wa-quote-out px-2 py-1.5">
              {options.map((option) => (
                <span key={option.id} className="flex flex-col">
                  <span className="text-[13px] text-wa-text">{option.title}</span>
                  {option.description ? (
                    <span className="text-[12px] text-wa-muted">{option.description}</span>
                  ) : null}
                </span>
              ))}
            </span>
          </span>
        ) : null}
      </div>
    </div>
  );
}

export interface WaPhonePreviewProps {
  title: string;
  children: ReactNode;
}

/**
 * Celular simulado: moldura estreita com o fundo de rabiscos do chat, para a
 * configuração ser conferida no lugar onde ela aparece de verdade.
 */
export function WaPhonePreview({ title, children }: WaPhonePreviewProps) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-wa-line bg-wa-panel">
      <p className="border-b border-wa-line bg-wa-header px-3 py-2 text-[12px] font-semibold uppercase tracking-wide text-wa-muted">
        {title}
      </p>
      <div className="wa-doodle flex min-h-48 flex-col gap-2 p-3">{children}</div>
    </div>
  );
}
