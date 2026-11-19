import { createFileRoute, useNavigate } from '@tanstack/react-router';
import type { WaConversationFilter } from '@/api/types';
import { PageSkeleton } from '@/features/shell/components/page-skeleton';
import { workspaceQuery } from '@/features/settings/api';
import { WhatsappPage } from '@/features/whatsapp/components/whatsapp-page';
import {
  resolveWaFilter,
  resolveWaPeriod,
  resolveWaTab,
  type WaPeriodDays,
  type WaTabId,
} from '@/features/whatsapp/whatsapp-model';
import { useWaAccess } from '@/features/whatsapp/hooks/use-wa-access';

interface WhatsappSearch {
  /** Aba aberta da Central. */
  aba?: string;
  /** Conversa aberta. */
  conversa?: string;
  /** Filtro da lista de conversas. */
  filtro?: WaConversationFilter;
  /** Busca da lista de conversas. */
  busca?: string;
  /** Painel do cliente aberto (tela cheia abaixo de 1280). */
  painel?: boolean;
  /** Janela da Visão geral, em dias. */
  periodo?: string;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function Page() {
  const { wsId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { level } = useWaAccess(wsId);
  const tab = resolveWaTab(search.aba, level);
  const period = resolveWaPeriod(search.periodo);

  return (
    <WhatsappPage
      wsId={wsId}
      tab={tab}
      conversationId={search.conversa}
      filter={resolveWaFilter(search.filtro)}
      term={search.busca ?? ''}
      panelOpen={search.painel === true}
      period={period}
      onNavigate={(next) => {
        const aba: WaTabId = next.aba ?? tab;
        const periodo: WaPeriodDays = next.periodo ?? period;

        void navigate({
          to: '/w/$wsId/whatsapp',
          params: { wsId },
          search: {
            aba,
            ...(next.conversa ? { conversa: next.conversa } : {}),
            ...(next.filtro ? { filtro: next.filtro } : {}),
            ...(next.busca ? { busca: next.busca } : {}),
            ...(next.painel ? { painel: true } : {}),
            ...(periodo === 30 ? {} : { periodo: String(periodo) }),
          },
        });
      }}
    />
  );
}

export const Route = createFileRoute('/_app/w/$wsId/whatsapp')({
  validateSearch: (search: Record<string, unknown>): WhatsappSearch => ({
    ...(text(search.aba) ? { aba: text(search.aba) } : {}),
    ...(text(search.conversa) ? { conversa: text(search.conversa) } : {}),
    ...(text(search.filtro) ? { filtro: resolveWaFilter(text(search.filtro)) } : {}),
    ...(text(search.busca) ? { busca: text(search.busca) } : {}),
    ...(search.painel === true || search.painel === 'true' ? { painel: true } : {}),
    ...(text(search.periodo) ? { periodo: String(resolveWaPeriod(text(search.periodo))) } : {}),
  }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(workspaceQuery(params.wsId)),
  component: Page,
  pendingComponent: PageSkeleton,
});
