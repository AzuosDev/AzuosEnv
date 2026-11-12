import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { ChannelLocationType, Message, WorkspaceRole } from '@/api/types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SelectNative } from '@/components/ui/select-native';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { useSession } from '@/features/auth/session';
import { membersQuery } from '@/features/settings/api';
import { useMinWidth } from '@/lib/use-min-width';
import { useNavigate } from '@tanstack/react-router';
import { channelsQuery, messageToTask } from '../api';
import { canWriteChannel } from '../chat-model';
import { useChannelActions } from '../hooks/use-channels';
import { useChatRealtime } from '../hooks/use-chat-realtime';
import { ChannelConversation } from './channel-conversation';
import { MessageToTaskDialog, NewChannelDialog } from './chat-dialogs';
import { ThreadPanel } from './thread-panel';

export interface ChannelSurfaceProps {
  wsId: string;
  /** Local da hierarquia de onde o canal é aba. */
  locationType: Exclude<ChannelLocationType, 'workspace'>;
  locationId: string;
  role: WorkspaceRole;
}

/** A partir daqui a conversa e a thread cabem lado a lado dentro da view. */
const WIDE_PX = 1280;

/**
 * Canal como view de um Space, Folder ou List: a conversa do canal ligado
 * àquele local, com a thread ao lado. Local sem canal oferece criar o primeiro.
 */
export function ChannelSurface({ wsId, locationType, locationId, role }: ChannelSurfaceProps) {
  const user = useSession();
  const navigate = useNavigate();
  const channels = useQuery(channelsQuery(wsId, { locationType, locationId }));
  const members = useQuery(membersQuery(wsId));
  const actions = useChannelActions(wsId);
  const wide = useMinWidth(WIDE_PX);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [newChannel, setNewChannel] = useState(false);
  const [toTask, setToTask] = useState<Message | null>(null);
  const [creating, setCreating] = useState(false);

  const items = channels.data ?? [];
  const active = items.find((channel) => channel.id === pickedId) ?? items[0] ?? null;

  useChatRealtime(
    wsId,
    items.map((channel) => channel.id),
  );

  if (channels.isPending) {
    return (
      <div className="px-4 py-8 md:px-6">
        <Spinner label="Carregando o canal" />
      </div>
    );
  }

  if (!active) {
    return (
      <>
        <div className="px-4 pb-8 md:px-6">
          <EmptyState
            title="Nenhum canal neste local"
            description="Crie o canal deste local para a conversa ficar junto do trabalho."
            action={
              role === 'guest' ? undefined : (
                <Button
                  onClick={() => {
                    setNewChannel(true);
                  }}
                >
                  Criar canal
                </Button>
              )
            }
          />
        </div>

        <NewChannelDialog
          wsId={wsId}
          open={newChannel}
          members={members.data ?? []}
          currentUserId={user?.id}
          pending={actions.pending}
          fixedLocation={{ location: locationType, locationId }}
          onOpenChange={setNewChannel}
          onCreate={(input) => {
            void actions.create({ ...input, locationType, locationId }).then((channel) => {
              if (channel) {
                setNewChannel(false);
                setPickedId(channel.id);
              }
            });
          }}
        />
      </>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {items.length > 1 ? (
        <div className="flex shrink-0 items-center gap-2 px-4 pb-2 md:px-6">
          <label htmlFor="surface-channel" className="text-[12.5px] text-muted">
            Canal
          </label>
          <SelectNative
            id="surface-channel"
            className="max-w-xs"
            value={active.id}
            onChange={(event) => {
              setPickedId(event.target.value);
              setThreadId(null);
            }}
          >
            {items.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.name}
              </option>
            ))}
          </SelectNative>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {threadId === null || wide ? (
          <ChannelConversation
            wsId={wsId}
            channel={active}
            members={members.data ?? []}
            currentUserId={user?.id}
            role={role}
            actions={actions}
            onOpenThread={setThreadId}
            onCreateTask={setToTask}
          />
        ) : null}

        {threadId !== null ? (
          <ThreadPanel
            wsId={wsId}
            channelId={active.id}
            rootId={threadId}
            members={members.data ?? []}
            currentUserId={user?.id}
            role={role}
            canWrite={canWriteChannel(active, role, user?.id)}
            onClose={() => {
              setThreadId(null);
            }}
          />
        ) : null}
      </div>

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
