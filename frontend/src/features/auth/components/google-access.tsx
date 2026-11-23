import { Button } from '@/components/ui/button';
import { GlassDivider } from '@/features/auth/components/glass-field';
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
      variant="glass"
      size="lg"
      className={cn('h-[52px] w-full gap-3 rounded-[14px] text-[15px] font-medium', className)}
    >
      <a href={googleLoginUrl({ next, invite })} data-testid="google-login" rel="nofollow">
        <GoogleLogo />
        {label}
      </a>
    </Button>
  );
}

/** O divisor "ou" e o botão do Google, abaixo do formulário do cartão. */
export function GoogleAccess(props: GoogleAccessProps) {
  return (
    <>
      <GlassDivider />
      <GoogleButton {...props} />
    </>
  );
}
