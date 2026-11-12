import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export interface SecretNoticeProps {
  label: string;
  value: string;
  /** O que acontece se a pessoa perder o valor. */
  warning?: string;
}

/** Valor que o servidor mostra uma única vez: fica visível e dá para copiar. */
export function SecretNotice({ label, value, warning }: SecretNoticeProps) {
  const [copied, setCopied] = useState(false);

  return (
    <div
      className="flex flex-col gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3"
      role="status"
      aria-label={label}
    >
      <p className="text-[12.5px] font-semibold text-ink">{label}</p>
      <code className="break-all rounded-lg border border-line bg-surface px-2 py-1.5 text-[12.5px] text-ink">
        {value}
      </code>
      {warning ? <p className="text-[12px] text-muted">{warning}</p> : null}
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        onClick={() => {
          void navigator.clipboard?.writeText(value).then(
            () => {
              setCopied(true);
            },
            () => {
              setCopied(false);
            },
          );
        }}
      >
        {copied ? (
          <Check className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Copy className="h-4 w-4" aria-hidden="true" />
        )}
        {copied ? 'Copiado' : 'Copiar'}
      </Button>
    </div>
  );
}
