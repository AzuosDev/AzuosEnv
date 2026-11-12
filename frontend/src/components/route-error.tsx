import { Link, useRouter } from '@tanstack/react-router';
import { CloudOff, LogIn, RotateCcw, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { ApiRequestError } from '@/api/errors';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { isNetworkError } from '@/lib/use-online';

export type RouteErrorKind = 'session' | 'offline' | 'unexpected';

/** Classifica o erro que estourou na rota para escolher a tela certa. */
export function routeErrorKind(error: unknown): RouteErrorKind {
  if (error instanceof ApiRequestError && (error.statusCode === 401 || error.statusCode === 403)) {
    return 'session';
  }

  if (isNetworkError(error)) {
    return 'offline';
  }

  return 'unexpected';
}

const COPY: Record<RouteErrorKind, { title: string; description: string }> = {
  session: {
    title: 'Sua sessão expirou',
    description: 'Por segurança, entre de novo para continuar de onde você parou.',
  },
  offline: {
    title: 'Você está sem conexão',
    description: 'Não deu para falar com o servidor. Verifique a internet e tente de novo.',
  },
  unexpected: {
    title: 'Algo deu errado nesta tela',
    description: 'O resto do Azuos Env continua funcionando. Tente carregar de novo.',
  },
};

const ICON = {
  session: LogIn,
  offline: CloudOff,
  unexpected: TriangleAlert,
};

export interface RouteErrorProps {
  error: unknown;
  /** Reset do error boundary da rota, quando o router mandar um. */
  reset?: () => void;
}

/**
 * Tela de erro de uma rota: a navegação em volta continua de pé e "Tentar de
 * novo" recarrega só esta rota. Erro de sessão leva ao login. Não é <main>: a
 * rota com erro cai dentro do <main> do shell, e dois landmarks se anulam.
 */
export function RouteError({ error, reset }: RouteErrorProps) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const kind = routeErrorKind(error);
  const { title, description } = COPY[kind];
  const Icon = ICON[kind];
  const detail = error instanceof Error ? error.message : '';

  const retry = () => {
    setRetrying(true);
    reset?.();
    void router.invalidate().finally(() => {
      setRetrying(false);
    });
  };

  return (
    <div className="mx-auto flex min-h-[60dvh] w-full max-w-2xl items-center px-4 py-8">
      <EmptyState
        className="w-full"
        icon={<Icon className="h-6 w-6" aria-hidden="true" />}
        title={title}
        description={kind === 'unexpected' && detail ? `${description} (${detail})` : description}
        action={
          kind === 'session' ? (
            <Button asChild>
              <Link to="/login" search={{ expirado: true }}>
                Entrar de novo
              </Link>
            </Button>
          ) : (
            <Button onClick={retry} disabled={retrying}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Tentar de novo
            </Button>
          )
        }
      />
    </div>
  );
}
