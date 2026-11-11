import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import type { Message } from '@/api/types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { useSession } from '@/features/auth/session';
import { membersQuery, workspaceQuery } from '@/features/settings/api';
import { useMinWidth } from '@/lib/use-min-width';
import { channelsQuery, chatActivityQuery, messageToTask } from '../api';
import { canWriteChannel, splitChannels } from '../chat-model';
import { useChannelActions } from '../hooks/use-channels';
import { useChatRealtime } from '../hooks/use-chat-realtime';
import { ChannelConversation } from './channel-conversation';
import { ChannelList } from './channel-list';
import { MessageToTaskDialog, NewChannelDialog, NewDmDialog } from './chat-dialogs';
import { ThreadPanel } from './thread-panel';

export interface ChatPageProps {
  wsId: string;
  /** Canal aberto, pela query string da rota. */
  channelId: string | undefined;
  /** Thread aberta, pela query string da rota. */
  threadId: string | undefined;
}

/** A partir daqui a lista fica fixa ao lado da conversa. */
const WIDE_PX = 1024;

/**
 * A thread só fica ao lado da conversa a partir daqui: em 1024 a lista de 264
 * px e a thread de 380 px sobram quase nada para a conversa.
 */
const THREE_PANE_PX = 1280;

/**
 * Tela do Chat: lista de canais, conversa e thread. Abaixo de 1024 px as três
 * viram pilha — a lista leva à conversa, e a conversa leva à thread.
 */
export function ChatPage({ wsId, channelId, threadId }: ChatPageProps) {
  const navigate = useNavigate();
  const user = useSession();
  const { data: workspace } = useSuspenseQuery(workspaceQuery(wsId));
  const channels = useQuery(channelsQuery(wsId));
  const activity = useQuery(chatActivityQuery(wsId));
  const members = useQuery(membersQuery(wsId));
  const actions = useChannelActions(wsId);
  const wide = useMinWidth(WIDE_PX);
  const threePane = useMinWidth(THREE_PANE_PX);
  const [newChannel, setNewChannel] = useState(false);
  const [newDm, setNewDm] = useState(false);
  const [toTask, setToTask] = useState<Message | null>(null);
  const [creating, setCreating] = useState(false);

  const items = channels.data ?? [];
  const groups = splitChannels(items);
  const active = items.find((channel) => channel.id === channelId) ?? null;
  const role = workspace.role;
  const canCreate = role !== 'guest';

  useChatRealtime(
    wsId,
    items.map((channel) => channel.id),
  );

  const go = (next: { canal?: string; thread?: string }): void => {
    void navigate({
      to: '/w/$wsId/chat',
      params: { wsId },
      search: next,
    });
  };

  const openChannel = (id: string): void => {
    go({ canal: id });
  };

  /** No celular a lista só aparece quando nenhum canal está aberto. */
  const showList = wide || active === null;
  const showThread = threadId !== undefined && active !== null;
  const showConversation = active !== null && (threePane || !showThread);

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      {showList ? (
        <aside
          aria-label="Canais e mensagens diretas"
          className="flex min-h-0 flex-1 flex-col border-line bg-paper-2 lg:w-[264px] lg:flex-none lg:border-r"
        >
          <div className="flex shrink-0 items-center gap-2 px-4 pt-4">
            <h1 className="heading min-w-0 flex-1 truncate text-xl">Chat</h1>
          </div>

          {channels.isPending ? (
            <div className="px-4 py-6">
              <Spinner label="Carregando os canais" />
            </div>
          ) : (
            <ChannelList
              channels={groups.channels}
              dms={groups.dms}
              activity={activity.data}
              members={members.data ?? []}
              currentUserId={user?.id}
              activeId={active?.id ?? null}
              canCreate={canCreate}
              onPick={openChannel}
              onNewChannel={() => {
                setNewChannel(true);
              }}
              onNewDm={() => {
                setNewDm(true);
              }}
            />
          )}
        </aside>
      ) : null}

      {showConversation && active ? (
        <ChannelConversation
          wsId={wsId}
          channel={active}
          members={members.data ?? []}
          currentUserId={user?.id}
          role={role}
          actions={actions}
          onOpenThread={(messageId) => {
            go({ canal: active.id, thread: messageId });
          }}
          onCreateTask={setToTask}
          {...(wide
            ? {}
            : {
                onBack: () => {
                  go({});
                },
              })}
        />
      ) : null}

      {showThread && active && threadId ? (
        <ThreadPanel
          wsId={wsId}
          channelId={active.id}
          rootId={threadId}
          members={members.data ?? []}
          currentUserId={user?.id}
          role={role}
          canWrite={canWriteChannel(active, role, user?.id)}
          onClose={() => {
            go({ canal: active.id });
          }}
        />
      ) : null}

      {wide && active === null && !channels.isPending ? (
        <div className="flex min-h-0 flex-1 items-start px-4 py-8 md:px-6">
          <EmptyState
            title={items.length === 0 ? 'Nenhum canal ainda' : 'Escolha uma conversa'}
            description={
              items.length === 0
                ? 'Crie o primeiro canal do workspace ou abra uma conversa direta.'
                : 'Escolha um canal ou uma conversa na lista ao lado.'
            }
            action={
              canCreate && items.length === 0 ? (
                <Button
                  onClick={() => {
                    setNewChannel(true);
                  }}
                >
                  Novo canal
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : null}

      <NewChannelDialog
        wsId={wsId}
        open={newChannel}
        members={members.data ?? []}
        currentUserId={user?.id}
        pending={actions.pending}
        onOpenChange={setNewChannel}
        onCreate={(input) => {
          void actions.create(input).then((channel) => {
            if (channel) {
              setNewChannel(false);
              openChannel(channel.id);
            }
          });
        }}
      />

      <NewDmDialog
        open={newDm}
        members={members.data ?? []}
        currentUserId={user?.id}
        pending={actions.pending}
        onOpenChange={setNewDm}
        onPick={(userId) => {
          void actions.dm(userId).then((channel) => {
            if (channel) {
              setNewDm(false);
              openChannel(channel.id);
            }
          });
        }}
      />

      <MessageToTaskDialog
        wsId={wsId}
        message={toTask}
        pending={creating}
        onOpenChange={(open) => {
          if (!open) {
            setToTask(null);
          }
        }}
        onCreate={(listId) => {
          if (!toTask) {
            return;
          }

          setCreating(true);
          void messageToTask(wsId, toTask.id, listId)
            .then((result) => {
              setToTask(null);
              toast.success(`Tarefa ${result.task.customId} criada.`, {
                action: {
                  label: 'Abrir',
                  onClick: () => {
                    void navigate({
                      to: '/w/$wsId/t/$customId',
                      params: { wsId, customId: result.task.customId },
                    });
                  },
                },
              });
            })
            .catch(() => {
              toast.error('Não foi possível criar a tarefa.');
            })
            .finally(() => {
              setCreating(false);
            });
        }}
      />
    </div>
  );
}
