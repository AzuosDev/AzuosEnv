import { Button } from '@/components/ui/button';
import { googleLoginUrl } from '@/features/auth/api';
import { GoogleLogo } from '@/features/auth/components/google-logo';
import { cn } from '@/lib/utils';

export interface GoogleAccessProps {
  /** Caminho interno para onde voltar depois de entrar. */
  next?: string;
  /** Token do convite, quando o acesso começa em /convite/$token. */
  invite?: string;
  label?: string;
  className?: string;
}

/**
 * Botão oficial "Continuar com Google": container claro ou escuro pelo tema
 * (tokens surface/line/ink) com o logo G nas cores da marca, como as diretrizes
 * do Google pedem. Navegação de página inteira para /api/v1/auth/google.
 */
export function GoogleButton({
  next,
  invite,
  label = 'Continuar com Google',
  className,
}: GoogleAccessProps) {
  return (
    <Button
      asChild
      variant="outline"
      size="lg"
      className={cn('w-full rounded-full border-line', className)}
    >
      <a href={googleLoginUrl({ next, invite })} data-testid="google-login" rel="nofollow">
        <GoogleLogo />
        {label}
      </a>
    </Button>
  );
}

/** O botão do Google acima do formulário, com o divisor "ou". */
export function GoogleAccess(props: GoogleAccessProps) {
  return (
    <div className="mb-6 flex flex-col gap-6">
      <GoogleButton {...props} />

      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">ou</span>
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}
