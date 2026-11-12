import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Hash, Lock, LogIn, LogOut, MoreHorizontal, Users } from 'lucide-react';
import { useState } from 'react';
import type { Channel, Message, WorkspaceMemberItem, WorkspaceRole } from '@/api/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { Spinner } from '@/components/ui/spinner';
import { channelAttachmentsQuery, messagesQuery } from '../api';
import {
  canManageChannel,
  canWriteChannel,
  channelTitle,
  isChannelMember,
  mergeMessagePages,
  memberUser,
  typingLabel,
} from '../chat-model';
import { useMarkRead, type ChannelActions } from '../hooks/use-channels';
import { useTyping } from '../hooks/use-chat-realtime';
import { useMessages } from '../hooks/use-messages';
import { ChannelMembersDialog } from './chat-dialogs';
import { MessageComposer } from './message-composer';
import { MessageList } from './message-list';

export interface ChannelConversationProps {
  wsId: string;
  channel: Channel;
  members: WorkspaceMemberItem[];
  currentUserId: string | undefined;
  role: WorkspaceRole;
  actions: ChannelActions;
  /** Abre a thread da mensagem no painel lateral. */
  onOpenThread: (messageId: string) => void;
  onCreateTask: (message: Message) => void;
  /** Volta para a lista de canais na pilha do celular. */
  onBack?: () => void;
}

function describeChannel(channel: Channel): string {
  if (channel.type === 'dm') {
    return 'Conversa direta';
  }

  const scope =
    channel.locationType === 'workspace'
      ? 'Canal do workspace'
      : `Canal ligado a um ${channel.locationType === 'space' ? 'Space' : channel.locationType === 'folder' ? 'Folder' : 'List'}`;

  return channel.private ? `${scope} · privado` : scope;
}

/**
 * Conversa do canal: cabeçalho, mensagens com rolagem infinita para cima,
 * "digitando…" e o editor compacto fixo embaixo.
 */
export function ChannelConversation({
  wsId,
  channel,
  members,
  currentUserId,
  role,
  actions,
  onOpenThread,
  onCreateTask,
  onBack,
}: ChannelConversationProps) {
  const [membersOpen, setMembersOpen] = useState(false);
  const messages = useInfiniteQuery(messagesQuery(wsId, channel.id));
  const attachments = useQuery(channelAttachmentsQuery(wsId, channel.id));
  const items = mergeMessagePages(messages.data?.pages);
  const actionsOfMessage = useMessages(wsId, channel.id);
  const typing = useTyping(wsId, channel.id, currentUserId);
  const title = channelTitle(channel, members, currentUserId);
  const inside = isChannelMember(channel, currentUserId);
  const canWrite = canWriteChannel(channel, role, currentUserId);
  const canManage = canManageChannel(channel, role, currentUserId);
  const names = typing.userIds
    .map((userId) => memberUser(members, userId)?.name)
    .filter((name): name is string => Boolean(name));

  useMarkRead(wsId, channel.id, items.at(-1)?.id ?? null);

  return (
    <section
      aria-label={`Conversa de ${title}`}
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-paper"
    >
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-3 py-2 md:px-4">
        {onBack ? (
          <Button variant="nav" size="icon" aria-label="Voltar para os canais" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="flex min-w-0 items-center gap-1.5 text-[15px] font-semibold text-ink">
            {channel.type === 'dm' ? null : (
              <Hash className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            )}
            <span className="truncate">{title}</span>
            {channel.private ? (
              <Lock className="h-3.5 w-3.5 shrink-0 text-muted" aria-label="Privado" />
            ) : null}
          </h2>
          <p className="truncate text-[12.5px] text-muted">{describeChannel(channel)}</p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setMembersOpen(true);
          }}
        >
          <Users className="h-4 w-4" aria-hidden="true" />
          {`Membros · ${String(channel.memberIds.length)}`}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="nav" size="icon" aria-label={`Ações de ${title}`}>
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {channel.type !== 'dm' && !inside ? (
              <DropdownMenuItem
                onSelect={() => {
                  actions.join(channel.id);
                }}
              >
                <LogIn className="h-4 w-4" aria-hidden="true" />
                Entrar no canal
              </DropdownMenuItem>
            ) : null}

            {channel.type !== 'dm' && inside ? (
              <DropdownMenuItem
                onSelect={() => {
                  actions.leave(channel.id);
                }}
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sair do canal
              </DropdownMenuItem>
            ) : null}

            <DropdownMenuItem
              onSelect={() => {
                setMembersOpen(true);
              }}
            >
              <Users className="h-4 w-4" aria-hidden="true" />
              Participantes
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {messages.isPending ? (
        <div className="flex-1 px-4 py-8">
          <Spinner label="Carregando as mensagens" />
        </div>
      ) : null}

      {!messages.isPending && items.length === 0 ? (
        <div className="flex-1 px-4 py-8">
          <EmptyState
            title="Nenhuma mensagem ainda"
            description="Escreva a primeira mensagem deste canal."
          />
        </div>
      ) : null}

      {!messages.isPending && items.length > 0 ? (
        <MessageList
          wsId={wsId}
          channelId={channel.id}
          messages={items}
          members={members}
          attachments={attachments.data ?? []}
          currentUserId={currentUserId}
          role={role}
          canWrite={canWrite}
          actions={actionsOfMessage}
          hasMore={messages.hasNextPage}
          loadingMore={messages.isFetchingNextPage}
          onLoadMore={() => {
            void messages.fetchNextPage();
          }}
          onOpenThread={onOpenThread}
          onCreateTask={onCreateTask}
        />
      ) : null}

      <div className="shrink-0 border-t border-line px-3 pb-3 pt-2 md:px-4">
        <p aria-live="polite" className="min-h-4 pb-1 text-[11.5px] text-muted">
          {typingLabel(names)}
        </p>

        {canWrite ? (
          <MessageComposer
            wsId={wsId}
            channelId={channel.id}
            members={members}
            label={`Mensagem para ${title}`}
            placeholder={`Mensagem para ${title} · @ menciona`}
            submitLabel="Enviar"
            submitVariant="signal"
            pending={actionsOfMessage.sending}
            withAttachments
            onTyping={typing.notify}
            onSubmit={(draft) => {
              typing.stop();
              void actionsOfMessage.send(draft);
            }}
          />
        ) : (
          <p className="py-2 text-[12.5px] text-muted">
            {role === 'guest'
              ? 'Convidado não escreve no chat.'
              : 'Entre no canal para escrever aqui.'}
          </p>
        )}
      </div>

      <ChannelMembersDialog
        open={membersOpen}
        channel={channel}
        members={members}
        currentUserId={currentUserId}
        pending={actions.pending}
        canManage={canManage}
        onOpenChange={setMembersOpen}
        onAdd={(userIds) => {
          actions.addMembers(channel.id, userIds);
        }}
        onRemove={(userId) => {
          actions.removeMember(channel.id, userId);
        }}
      />
    </section>
  );
}
