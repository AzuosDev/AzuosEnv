import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';

export interface FieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

/** Campo de formulário com label nativo, dica e mensagem de erro. */
export function Field({ id, label, error, hint, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-[12px] text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[12px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Erro geral do formulário (credenciais, 429, falha do servidor). */
export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-danger"
    >
      {children}
    </div>
  );
}
