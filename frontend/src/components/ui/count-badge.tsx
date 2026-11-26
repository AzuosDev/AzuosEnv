import { cn } from '@/lib/utils';

export interface CountBadgeProps {
  count: number;
  /** O que está sendo contado, já no plural certo: "mensagens não lidas". */
  label: string;
  /** `wa` usa o verde da Central do WhatsApp no lugar do violeta. */
  tone?: 'accent' | 'wa';
  className?: string;
}

/** Acima disso o número vira 99+: mais dígitos quebram a linha da navegação. */
const MAX = 99;

const TONE = {
  accent: 'bg-accent text-on-signal',
  wa: 'bg-wa-brand text-wa-panel',
} as const;

/**
 * Contagem que pede atenção (não lidas): círculo cheio de 20 px, numeral
 * tabular para a coluna não dançar entre as linhas. Some sozinha no zero.
 */
export function CountBadge({ count, label, tone = 'accent', className }: CountBadgeProps) {
  if (count <= 0) {
    return null;
  }

  return (
    <span
      className={cn(
        'inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums',
        TONE[tone],
        className,
      )}
    >
      {count > MAX ? `${String(MAX)}+` : count}
      <span className="sr-only"> {label}</span>
    </span>
  );
}
