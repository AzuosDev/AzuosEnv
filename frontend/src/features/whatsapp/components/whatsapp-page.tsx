import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { HardHat } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { useSession } from '@/features/auth/session';
import type { WaConversationFilter } from '@/api/types';
import { waConnectionQuery, waConversationsQuery } from '../api';
import { hasWaLevel, visibleWaTabs, type WaPeriodDays, type WaTabId } from '../whatsapp-model';
import { useWaAccess } from '../hooks/use-wa-access';
import { useWaRealtime } from '../hooks/use-wa-realtime';
import { BotRulesTab } from './bot-rules-tab';
import { BotSettingsTab } from './bot-settings-tab';
import { ConnectionTab } from './connection-tab';
import { ContactsTab } from './contacts-tab';
import { ConversationsTab } from './conversations-tab';
import { HoursTab } from './hours-tab';
import { OverviewTab } from './overview-tab';
import { QuickRepliesTab } from './quick-replies-tab';
import { TeamTab } from './team-tab';
import { WaEmpty } from './wa-empty';
import { WhatsappGlyph } from './whatsapp-glyph';

export interface WhatsappPageProps {
  wsId: string;
  tab: WaTabId;
  conversationId: string | undefined;
  filter: WaConversationFilter;
  term: string;
  panelOpen: boolean;
  /** Janela da Visão geral, em dias. */
  period: WaPeriodDays;
  onNavigate: (next: {
    aba?: WaTabId;
    conversa?: string;
    filtro?: WaConversationFilter;
    busca?: string;
    painel?: boolean;
    periodo?: WaPeriodDays;
  }) => void;
}

/**
 * Central do WhatsApp: cabeçalho com o estado da conexão, abas conforme o
 * nível e a aba aberta. Toda a cor sai da paleta do módulo (data-module).
 */
export function WhatsappPage({
  wsId,
  tab,
  conversationId,
  filter,
  term,
  panelOpen,
  period,
  onNavigate,
}: WhatsappPageProps) {
  const user = useSession();
  const { level, isPending } = useWaAccess(wsId);
  const connection = useQuery({ ...waConnectionQuery(wsId), enabled: level !== null });
  const unread = useInfiniteQuery({
    ...waConversationsQuery(wsId, { filter: 'unread' }),
    enabled: level !== null,
  });

  useWaRealtime(wsId, {
    openConversationId: conversationId ?? null,
    currentUserId: user?.id,
  });

  if (isPending) {
    return (
      <div className="p-4 md:p-6">
        <Spinner label="Carregando a Central do WhatsApp" />
      </div>
    );
  }

  if (!level) {
    return (
      <div className="px-4 py-8 md:px-6">
        <EmptyState
          title="Sem acesso ao WhatsApp"
          description="A Central do WhatsApp é liberada pelo gestor do atendimento."
        />
      </div>
    );
  }

  const tabs = visibleWaTabs(level);
  const current = tabs.find((item) => item.id === tab) ?? tabs[0];
  const status = connection.data?.connection?.status ?? null;
  const unreadCount = unread.data?.pages[0]?.items.length ?? 0;

  return (
    <div data-module="whatsapp" className="flex h-full min-h-0 flex-col bg-wa-bg text-wa-text">
      <header className="shrink-0 border-b border-wa-line bg-wa-header px-3 pt-3 md:px-4">
        <div className="flex flex-wrap items-center gap-2">
          <WhatsappGlyph className="h-6 w-6 shrink-0 text-wa-brand" />
          <h1 className="heading min-w-0 flex-1 truncate text-xl text-wa-text">
            Central do WhatsApp
          </h1>
          <span
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold',
              status === 'connected'
                ? 'border-wa-brand text-wa-brand'
                : 'border-wa-line text-wa-muted',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'h-2 w-2 rounded-full',
                status === 'connected' ? 'bg-wa-brand' : 'bg-wa-muted',
              )}
            />
            {status === 'connected'
              ? 'WhatsApp conectado'
              : status === 'error'
                ? 'WhatsApp com erro'
                : status === 'pending'
                  ? 'WhatsApp pendente'
                  : 'WhatsApp sem conexão'}
          </span>
        </div>

        <nav aria-label="Seções do WhatsApp" className="-mx-1 mt-2 overflow-x-auto px-1">
          <ul className="flex min-w-max items-center gap-1">
            {tabs.map((item) => {
              const active = item.id === current?.id;

              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-current={active ? 'page' : undefined}
                    onClick={() => {
                      onNavigate({ aba: item.id });
                    }}
                    className={cn(
                      'flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-t-lg border-b-2 px-3 text-[13px] font-medium',
                      active
                        ? 'border-wa-accent text-wa-text'
                        : 'border-transparent text-wa-muted hover:text-wa-text',
                    )}
                  >
                    {item.label}
                    {item.id === 'conversas' && unreadCount > 0 ? (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-wa-brand px-1 text-[11px] font-bold text-wa-panel">
                        {unreadCount >= 25 ? '25+' : unreadCount}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      {current?.id === 'conversas' ? (
        <ConversationsTab
          wsId={wsId}
          level={level}
          conversationId={conversationId}
          filter={filter}
          term={term}
          panelOpen={panelOpen}
          onNavigate={(next) => {
            onNavigate({ aba: 'conversas', ...next });
          }}
        />
      ) : null}

      {current?.id === 'contatos' ? (
        <ContactsTab wsId={wsId} canCreate={hasWaLevel(level, 'gestor')} />
      ) : null}

      {current?.id === 'visao-geral' ? (
        <OverviewTab
          wsId={wsId}
          period={period}
          onPeriodChange={(days) => {
            onNavigate({ aba: 'visao-geral', periodo: days });
          }}
        />
      ) : null}

      {current?.id === 'regras' ? <BotRulesTab wsId={wsId} /> : null}

      {current?.id === 'bot' ? <BotSettingsTab wsId={wsId} /> : null}

      {current?.id === 'respostas' ? <QuickRepliesTab wsId={wsId} /> : null}

      {current?.id === 'horarios' ? <HoursTab wsId={wsId} /> : null}

      {current?.id === 'conexao' ? <ConnectionTab wsId={wsId} /> : null}

      {current?.id === 'equipe' ? <TeamTab wsId={wsId} /> : null}

      {current && !current.ready ? (
        <div className="min-h-0 flex-1 overflow-y-auto bg-wa-bg px-3 py-6 md:px-4">
          <WaEmpty
            title="Em construção"
            description={`${current.label} entra na próxima etapa do WhatsApp.`}
            icon={<HardHat className="h-7 w-7" aria-hidden="true" />}
          />
        </div>
      ) : null}
    </div>
  );
}
