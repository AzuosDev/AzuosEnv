import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { CalendarCheck } from 'lucide-react';
import { StatusPill } from '@/components/ui/status-pill';
import { googleIntegrationQuery } from '@/features/admin/api';

/**
 * Atalho para a aba de Integrações. Conectar o Google é por conta (OAuth) e
 * acontece em Configurações; aqui só mostramos se a agenda já está ligada.
 */
export function GoogleCalendarButton({ wsId }: { wsId: string }) {
  const status = useQuery(googleIntegrationQuery(wsId));

  if (status.data?.connected === true) {
    return (
      <StatusPill tone="success">
        <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" />
        Google Agenda conectado
      </StatusPill>
    );
  }

  return (
    <Link
      to="/w/$wsId/configuracoes/integracoes"
      params={{ wsId }}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-[13px] text-muted no-underline hover:bg-surface-2 hover:text-ink md:min-h-9"
    >
      <CalendarCheck className="h-4 w-4" aria-hidden="true" />
      Conectar Google Agenda
    </Link>
  );
}
