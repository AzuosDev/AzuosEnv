import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { errorMessage } from '@/api/errors';
import type { AssignedCommentStatus, InboxTab } from '@/api/types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FormAlert } from '@/features/auth/components/field';
import { membersQuery } from '@/features/settings/api';
import { inboxCountsQuery } from '@/features/shell/api';
import { PageHeader } from '@/features/shell/components/page-header';
import { assignedCommentsQuery, inboxQuery, repliesQuery } from '../api';
import { useInboxActions } from '../hooks/use-inbox-actions';
import { INBOX_TAB_LABEL, INBOX_TABS, mergeNotificationPages } from '../notification-model';
import { CommentFeed } from './comment-feed';
import { NotificationRow } from './notification-row';
import { RemindersPanel } from './reminders-panel';
import { SnoozeDialog } from './snooze-dialog';

/** Abas da página, na ordem em que aparecem. */
type PageTab = InboxTab | 'replies' | 'assigned' | 'reminders';

const EXTRA_TAB_LABEL: Record<'replies' | 'assigned' | 'reminders', string> = {
  replies: 'Respostas',
  assigned: 'Atribuídos',
  reminders: 'Lembretes',
};

const EMPTY: Record<PageTab, { title: string; description: string }> = {
  primary: {
    title: 'Caixa de entrada limpa',
    description: 'O que foi direcionado a você aparece aqui: atribuição, menção e comentário.',
  },
  other: {
    title: 'Nada em Outros',
    description: 'Aqui chega o que você acompanha como seguidor, sem ser o alvo direto.',
  },
  later: {
    title: 'Nada adiado',
    description: 'Ao adiar uma notificação, ela espera aqui até a hora marcada.',
  },
  cleared: {
    title: 'Nada limpo ainda',
    description: 'As notificações que você limpar ficam guardadas nesta aba.',
  },
  replies: {
    title: 'Sem respostas novas',
    description: 'As respostas aos seus comentários aparecem aqui.',
  },
  assigned: {
    title: 'Nenhum comentário para você',
    description: 'Comentários atribuídos a você entram nesta aba até serem resolvidos.',
  },
  reminders: { title: '', description: '' },
};

function Badge({ value }: { value: number }) {
  if (value <= 0) {
    return null;
  }

  return (
    <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-on-signal">
      {value}
    </span>
  );
}

/** Uma aba de notificação: lista por cursor com as ações da linha. */
function NotificationList({ wsId, tab }: { wsId: string; tab: InboxTab }) {
  const actions = useInboxActions(wsId);
  const members = useQuery(membersQuery(wsId));
  const feed = useInfiniteQuery(inboxQuery(wsId, tab));
  const [picking, setPicking] = useState<string | null>(null);
  const items = mergeNotificationPages(feed.data?.pages);

  if (feed.isPending) {
    return <Skeleton className="h-40" />;
  }

  if (feed.isError) {
    return <FormAlert>{errorMessage(feed.error)}</FormAlert>;
  }

  if (items.length === 0) {
    return <EmptyState title={EMPTY[tab].title} description={EMPTY[tab].description} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col rounded-2xl border border-line bg-surface">
        {items.map((notification) => (
          <NotificationRow
            key={notification.id}
            wsId={wsId}
            tab={tab}
            notification={notification}
            members={members.data ?? []}
            onRead={(read) => {
              actions.setRead.mutate({ id: notification.id, read, tab });
            }}
            onSnooze={(until, label) => {
              actions.snooze.mutate({ id: notification.id, until, label });
            }}
            onSnoozePick={() => {
              setPicking(notification.id);
            }}
            onClear={() => {
              actions.clear.mutate({ id: notification.id });
            }}
          />
        ))}
      </ul>

      {feed.hasNextPage ? (
        <Button
          variant="nav"
          size="sm"
          className="self-start"
          disabled={feed.isFetchingNextPage}
          onClick={() => {
            void feed.fetchNextPage();
          }}
        >
          {feed.isFetchingNextPage ? <Spinner label="Carregando" /> : 'Carregar mais'}
        </Button>
      ) : null}

      <SnoozeDialog
        open={picking !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPicking(null);
          }
        }}
        onConfirm={(until) => {
          if (picking) {
            actions.snooze.mutate({ id: picking, until, label: 'a data escolhida' });
          }

          setPicking(null);
        }}
      />
    </div>
  );
}

/** Respostas aos meus comentários. */
function RepliesList({ wsId }: { wsId: string }) {
  const members = useQuery(membersQuery(wsId));
  const feed = useInfiniteQuery(repliesQuery(wsId));
  const items = (feed.data?.pages ?? []).flatMap((page) => page.items);

  if (feed.isPending) {
    return <Skeleton className="h-40" />;
  }

  if (feed.isError) {
    return <FormAlert>{errorMessage(feed.error)}</FormAlert>;
  }

  if (items.length === 0) {
    return <EmptyState title={EMPTY.replies.title} description={EMPTY.replies.description} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <CommentFeed wsId={wsId} items={items} members={members.data ?? []} />
      {feed.hasNextPage ? (
        <Button
          variant="nav"
          size="sm"
          className="self-start"
          disabled={feed.isFetchingNextPage}
          onClick={() => {
            void feed.fetchNextPage();
          }}
        >
          {feed.isFetchingNextPage ? <Spinner label="Carregando" /> : 'Carregar mais'}
        </Button>
      ) : null}
    </div>
  );
}

/** Comentários atribuídos a mim, com o recorte abertos/resolvidos. */
function AssignedList({ wsId }: { wsId: string }) {
  const [status, setStatus] = useState<AssignedCommentStatus>('open');
  const members = useQuery(membersQuery(wsId));
  const feed = useInfiniteQuery(assignedCommentsQuery(wsId, status));
  const items = (feed.data?.pages ?? []).flatMap((page) => page.items);

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Situação" className="flex items-center gap-1.5">
        {(['open', 'resolved'] as AssignedCommentStatus[]).map((value) => (
          <Button
            key={value}
            variant={status === value ? 'outline' : 'nav'}
            size="sm"
            aria-pressed={status === value}
            onClick={() => {
              setStatus(value);
            }}
          >
            {value === 'open' ? 'Abertos' : 'Resolvidos'}
          </Button>
        ))}
      </div>

      {feed.isPending ? <Skeleton className="h-40" /> : null}
      {feed.isError ? <FormAlert>{errorMessage(feed.error)}</FormAlert> : null}

      {feed.data && items.length === 0 ? (
        <EmptyState
          title={status === 'open' ? EMPTY.assigned.title : 'Nada resolvido ainda'}
          description={EMPTY.assigned.description}
        />
      ) : null}

      {items.length > 0 ? (
        <CommentFeed wsId={wsId} items={items} members={members.data ?? []} />
      ) : null}

      {feed.hasNextPage ? (
        <Button
          variant="nav"
          size="sm"
          className="self-start"
          disabled={feed.isFetchingNextPage}
          onClick={() => {
            void feed.fetchNextPage();
          }}
        >
          {feed.isFetchingNextPage ? <Spinner label="Carregando" /> : 'Carregar mais'}
        </Button>
      ) : null}
    </div>
  );
}

/** Inbox do workspace: notificações, respostas, atribuições e lembretes. */
export function InboxPage({ wsId }: { wsId: string }) {
  const [tab, setTab] = useState<PageTab>('primary');
  const counts = useQuery(inboxCountsQuery(wsId));
  const actions = useInboxActions(wsId);
  const badge: Record<InboxTab, number> = {
    primary: counts.data?.primary ?? 0,
    other: counts.data?.other ?? 0,
    later: counts.data?.later ?? 0,
    cleared: 0,
  };

  return (
    <div className="flex flex-col gap-4 pb-8">
      <PageHeader
        wsId={wsId}
        title="Inbox"
        description="O que chegou para você no workspace, em uma fila só."
        actions={
          <Button
            variant="ghost"
            size="sm"
            disabled={actions.readAll.isPending || (counts.data?.unread ?? 0) === 0}
            onClick={() => {
              actions.readAll.mutate();
            }}
          >
            {actions.readAll.isPending ? <Spinner label="Marcando" /> : 'Ler todas'}
          </Button>
        }
      />

      <div className="min-w-0 px-4 md:px-6">
        <Tabs
          value={tab}
          onValueChange={(value) => {
            setTab(value as PageTab);
          }}
          className="flex min-w-0 max-w-[880px] flex-col"
        >
          <TabsList className="min-w-0 overflow-x-auto">
            {INBOX_TABS.map((value) => (
              <TabsTrigger key={value} value={value} className="shrink-0">
                {INBOX_TAB_LABEL[value]}
                <Badge value={badge[value]} />
              </TabsTrigger>
            ))}
            {(['replies', 'assigned', 'reminders'] as const).map((value) => (
              <TabsTrigger key={value} value={value} className="shrink-0">
                {EXTRA_TAB_LABEL[value]}
              </TabsTrigger>
            ))}
          </TabsList>

          {INBOX_TABS.map((value) => (
            <TabsContent key={value} value={value}>
              {tab === value ? <NotificationList wsId={wsId} tab={value} /> : null}
            </TabsContent>
          ))}

          <TabsContent value="replies">
            {tab === 'replies' ? <RepliesList wsId={wsId} /> : null}
          </TabsContent>
          <TabsContent value="assigned">
            {tab === 'assigned' ? <AssignedList wsId={wsId} /> : null}
          </TabsContent>
          <TabsContent value="reminders">
            {tab === 'reminders' ? <RemindersPanel wsId={wsId} /> : null}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
