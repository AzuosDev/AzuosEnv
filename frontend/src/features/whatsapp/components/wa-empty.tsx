import type { ReactNode } from 'react';

export interface WaEmptyProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

/**
 * Estado vazio do módulo. O EmptyState do app traz a cena violeta da Azuos, que
 * brigaria com a paleta do WhatsApp: aqui o bloco usa as cores do módulo.
 */
export function WaEmpty({ title, description, icon, action }: WaEmptyProps) {
  return (
    <div className="flex min-h-56 w-full flex-col items-center justify-center gap-3 rounded-2xl border border-wa-line bg-wa-panel p-8 text-center">
      {icon ? <div className="text-wa-accent">{icon}</div> : null}
      <p className="text-base font-semibold text-wa-text">{title}</p>
      {description ? <p className="max-w-sm text-[13px] text-wa-muted">{description}</p> : null}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
