import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { MessageSquareDashed } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '@/api/errors';
import type { WaAccessLevel, WaConversationFilter, WaConversationItem } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { useSession } from '@/features/auth/session';
import { membersQuery } from '@/features/settings/api';
import { ListPicker } from '@/features/tasks/components/list-picker';
import { useMinWidth } from '@/lib/use-min-width';
import {
  waConversationQuery,
  waConversationToTask,
  waConversationsQuery,
  waTemplatesQuery,
} from '../api';
import { hasWaLevel, mergeWaPages } from '../whatsapp-model';
import { useMarkWaRead, useWaConversationActions } from '../hooks/use-wa-conversation';
import { ConversationChat } from './conversation-chat';
import { ConversationList } from './conversation-list';
import { WaEmpty } from './wa-empty';
import { CustomerPanel } from './customer-panel';

export interface ConversationsTabProps {
  wsId: string;
  level: WaAccessLevel;
  conversationId: string | undefined;
  filter: WaConversationFilter;
  term: string;
  /** Painel do cliente aberto; no celular ele é o terceiro passo da pilha. */
  panelOpen: boolean;
  onNavigate: (next: {
    conversa?: string;
    filtro?: WaConversationFilter;
    busca?: string;
    painel?: boolean;
  }) => void;
}

/** A partir daqui a lista fica fixa ao lado da conversa. */
const WIDE_PX = 1024;

/**
 * As três colunas só cabem juntas a partir daqui: em 1280 a lista de 340 px
 * mais o painel de 320 px deixariam a conversa sem espaço.
 */
const THREE_PANE_PX = 1440;

/** Aba Conversas: lista, conversa e painel do cliente. */
export function ConversationsTab({
  wsId,
  level,
  conversationId,
  filter,
  term,
  panelOpen,
  onNavigate,
}: ConversationsTabProps) {
  const navigate = useNavigate();
  const user = useSession();
  const wide = useMinWidth(WIDE_PX);
  const threePane = useMinWidth(THREE_PANE_PX);
  const list = useInfiniteQuery(waConversationsQuery(wsId, { filter, q: term }));
  const detail = useQuery({
    ...waConversationQuery(wsId, conversationId ?? ''),
    enabled: (conversationId ?? '') !== '',
  });
  const members = useQuery(membersQuery(wsId));
  const actions = useWaConversationActions(wsId, conversationId ?? null);
  const [taskOpen, setTaskOpen] = useState(false);
  const [listId, setListId] = useState('');
  const [creating, setCreating] = useState(false);

  const items = mergeWaPages<WaConversationItem>(list.data?.pages);
  const fromList = items.find((item) => item.id === conversationId) ?? null;
  const found = detail.data ?? fromList;
  // Só abre a conversa que veio inteira da API: um id inválido na URL não pode
  // desenhar um chat vazio no lugar do estado vazio.
  const active = found && typeof found.id === 'string' && found.id !== '' ? found : null;
  const templates = useQuery(waTemplatesQuery(wsId, active !== null));

  useMarkWaRead(wsId, active && active.unreadCount > 0 ? active.id : null);

  const showPanel = active !== null && (threePane || panelOpen);
  // Entre 1024 e 1440 o painel do cliente entra no lugar da lista; abaixo de
  // 1024 a navegação é em pilha e só uma coluna aparece por vez.
  const showList = active === null || (wide && !(showPanel && !threePane));
  const showChat = active !== null && (wide || !panelOpen);

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      {showList ? (
        <ConversationList
          items={items}
          activeId={active?.id ?? null}
          filter={filter}
          term={term}
          loading={list.isPending}
          hasMore={list.hasNextPage}
          loadingMore={list.isFetchingNextPage}
          onPick={(id) => {
            onNavigate({ conversa: id, filtro: filter, busca: term });
          }}
          onFilter={(next) => {
            onNavigate({ filtro: next, busca: term });
          }}
          onTerm={(next) => {
            onNavigate({
              filtro: filter,
              busca: next,
              ...(conversationId ? { conversa: conversationId } : {}),
            });
          }}
          onLoadMore={() => {
            void list.fetchNextPage();
          }}
        />
      ) : null}

      {showChat && active ? (
        <ConversationChat
          wsId={wsId}
          conversation={active}
          templates={templates.data ?? []}
          actions={actions}
          {...(wide
            ? {}
            : {
                onBack: () => {
                  onNavigate({ filtro: filter, busca: term });
                },
              })}
          {...(threePane
            ? {}
            : {
                onOpenPanel: () => {
                  onNavigate({ conversa: active.id, filtro: filter, busca: term, painel: true });
                },
              })}
        />
      ) : null}

      {showPanel && active ? (
        <CustomerPanel
          wsId={wsId}
          conversation={active}
          members={members.data ?? []}
          canAssignOthers={hasWaLevel(level, 'supervisor')}
          currentUserId={user?.id}
          actions={actions}
          fullScreen={!wide}
          {...(threePane
            ? {}
            : {
                onClose: () => {
                  onNavigate({ conversa: active.id, filtro: filter, busca: term });
                },
              })}
          onCreateTask={() => {
            setTaskOpen(true);
          }}
        />
      ) : null}

      {wide && active === null && !list.isPending ? (
        <div className="flex min-h-0 flex-1 items-start bg-wa-chat px-4 py-8 md:px-6">
          <WaEmpty
            title={items.length === 0 ? 'Nenhuma conversa ainda' : 'Escolha uma conversa'}
            description={
              items.length === 0
                ? 'As conversas aparecem aqui quando um cliente manda mensagem para o número conectado.'
                : 'Escolha uma conversa na lista ao lado para atender.'
            }
            icon={<MessageSquareDashed className="h-7 w-7" aria-hidden="true" />}
          />
        </div>
      ) : null}

      <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle className="heading pr-10 text-base">Criar tarefa da conversa</DialogTitle>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-body">List de destino</span>
            <ListPicker wsId={wsId} value={listId} onChange={setListId} />
          </label>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setTaskOpen(false);
              }}
            >
              Cancelar
            </Button>
            <Button
              disabled={listId === '' || creating || !active}
              onClick={() => {
                if (!active) {
                  return;
                }

                setCreating(true);
                void waConversationToTask(wsId, active.id, listId)
                  .then((task) => {
                    setTaskOpen(false);
                    setListId('');
                    toast.success(`Tarefa ${task.customId} criada.`, {
                      action: {
                        label: 'Abrir',
                        onClick: () => {
                          void navigate({
                            to: '/w/$wsId/t/$customId',
                            params: { wsId, customId: task.customId },
                          });
                        },
                      },
                    });
                  })
                  .catch((error: unknown) => {
                    toast.error(errorMessage(error));
                  })
                  .finally(() => {
                    setCreating(false);
                  });
              }}
            >
              Criar tarefa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
