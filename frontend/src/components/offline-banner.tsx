import { CloudOff } from 'lucide-react';
import { useOnline } from '@/lib/use-online';

/**
 * Aviso persistente de conexão caída. Fica acima da barra inferior do celular
 * (z-30, md:hidden) e não cobre nenhuma ação.
 */
export function OfflineBanner() {
  const online = useOnline();

  if (online) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[max(env(safe-area-inset-bottom),6px)] z-40 flex justify-center px-4 pb-16 md:pb-4"
    >
      <p className="flex items-center gap-2 rounded-full border border-line bg-surface-2 px-4 py-2 text-[13px] text-body shadow-lg">
        <CloudOff className="h-4 w-4 text-warning" aria-hidden="true" />
        Você está sem conexão. As alterações vão esperar a internet voltar.
      </p>
    </div>
  );
}
