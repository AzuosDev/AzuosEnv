import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import type { WorkspaceMemberItem, WorkspaceRole } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { channelAttachmentsQuery, messagesQuery, repliesQuery } from '../api';
import { mergeMessagePages, mergeReplyPages } from '../chat-model';
import { useMessages } from '../hooks/use-messages';
import { MessageComposer } from './message-composer';
import { MessageItem } from './message-item';
import { MessageList } from './message-list';

export interface ThreadPanelProps {
  wsId: string;
  channelId: string;
  rootId: string;
  members: WorkspaceMemberItem[];
  currentUserId: string | undefined;
  role: WorkspaceRole;
  canWrite: boolean;
  onClose: () => void;
}

/**
 * Thread em painel: a mensagem raiz em cima, as respostas em ordem e o editor
 * de resposta embaixo. No celular o painel ocupa a tela inteira.
 */
export function ThreadPanel({
  wsId,
  channelId,
  rootId,
  members,
  currentUserId,
  role,
  canWrite,
  onClose,
}: ThreadPanelProps) {
  const replies = useInfiniteQuery(repliesQuery(wsId, rootId));
  const conversation = useInfiniteQuery(messagesQuery(wsId, channelId));
  const attachments = useQuery(channelAttachmentsQuery(wsId, channelId));
  const items = mergeReplyPages(replies.data?.pages);
  // A raiz já está na conversa carregada; a thread não a busca de novo.
  const root =
    mergeMessagePages(conversation.data?.pages).find((message) => message.id === rootId) ?? null;
  const actions = useMessages(wsId, channelId);

  return (
    <section
      aria-label="Thread da mensagem"
      className="flex min-h-0 min-w-0 flex-1 flex-col border-line bg-paper xl:w-[380px] xl:flex-none xl:border-l"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2">
        <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">Thread</h2>
        <Button variant="nav" size="icon" aria-label="Fechar a thread" onClick={onClose}>
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </header>

      {root ? (
        <div className="shrink-0 border-b border-line px-2 py-2 md:px-3">
          <MessageItem
            wsId={wsId}
            channelId={channelId}
            message={root}
            members={members}
            attachments={attachments.data ?? []}
            currentUserId={currentUserId}
            role={role}
            canWrite={canWrite}
            actions={actions}
            leading
            reply
          />
        </div>
      ) : null}

      {replies.isPending ? (
        <div className="flex-1 px-4 py-6">
          <Spinner label="Carregando as respostas" />
        </div>
      ) : (
        <MessageList
          wsId={wsId}
          channelId={channelId}
          messages={items}
          members={members}
          attachments={attachments.data ?? []}
          currentUserId={currentUserId}
          role={role}
          canWrite={canWrite}
          actions={actions}
          hasMore={replies.hasNextPage}
          loadingMore={replies.isFetchingNextPage}
          onLoadMore={() => {
            void replies.fetchNextPage();
          }}
          reply
        />
      )}

      <div className="shrink-0 border-t border-line px-3 pb-3 pt-2">
        {canWrite ? (
          <MessageComposer
            wsId={wsId}
            channelId={channelId}
            members={members}
            label="Resposta da thread"
            placeholder="Responder na thread…"
            submitLabel="Responder"
            pending={actions.sending}
            onSubmit={(draft) => {
              void actions.reply(rootId, draft);
            }}
          />
        ) : (
          <p className="py-2 text-[12.5px] text-muted">Você não escreve neste canal.</p>
        )}
      </div>
    </section>
  );
}
