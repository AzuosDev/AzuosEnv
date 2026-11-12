import { useInfiniteQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { History } from 'lucide-react';
import { useMemo, useState } from 'react';
import type {
  Activity,
  CommentThread,
  EffectiveStatus,
  Tag,
  WorkspaceMemberItem,
  WorkspaceRole,
} from '@/api/types';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { activityLines, describeActivity, mergeFeed, type ResolveName } from '../activity-model';
import { commentsQuery, taskActivityQuery } from '../collaboration-api';
import { mergeThreadPages } from '../comment-model';
import { useComments } from '../hooks/use-comments';
import { CommentComposer } from './comment-composer';
import { CommentThreadItem } from './comment-item';

export interface ActivitySectionProps {
  wsId: string;
  customId: string;
  members: WorkspaceMemberItem[];
  statuses: EffectiveStatus[];
  tags: Tag[];
  currentUserId: string | undefined;
  role: WorkspaceRole;
  /** Falso quando o papel não permite comentar na tarefa. */
  canWrite: boolean;
}

type TabKey = 'comments' | 'history' | 'all';

const TAB_LABEL: Record<TabKey, string> = {
  comments: 'Comentários',
  history: 'Histórico',
  all: 'Tudo',
};

function stampOf(iso: string): { relative: string; exact: string } {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return { relative: '', exact: '' };
  }

  return {
    relative: formatDistanceToNow(date, { locale: ptBR, addSuffix: true }),
    exact: format(date, "d 'de' MMMM 'de' yyyy, HH:mm", { locale: ptBR }),
  };
}

/** Uma linha do histórico: quem fez, o que fez e os valores que mudaram. */
function ActivityRow({
  activity,
  members,
  resolve,
}: {
  activity: Activity;
  members: WorkspaceMemberItem[];
  resolve: ResolveName;
}) {
  const actor = members.find((member) => member.userId.id === String(activity.actorId))?.userId;
  const stamp = stampOf(activity.createdAt);
  const lines = activityLines(activity, resolve);
  const detailed = activity.action === 'updated' && lines.length > 0;

  return (
    <li className="flex min-w-0 gap-2.5 border-b border-line/60 pb-3 last:border-b-0">
      <Avatar name={actor?.name ?? 'Pessoa'} src={actor?.avatarUrl} className="h-7 w-7 shrink-0" />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-[13px] text-body">
          <span className="font-semibold text-ink">{actor?.name ?? 'Alguém'}</span>{' '}
          {describeActivity(activity, resolve)}
          <span className="text-muted" title={stamp.exact}>
            {' '}
            · {stamp.relative}
          </span>
        </p>

        {detailed ? (
          <ul className="flex flex-col gap-0.5">
            {lines.map((line) => (
              <li key={line.field} className="min-w-0 text-[12.5px] text-muted">
                <span className="text-body">{line.label}</span>: {line.from} → {line.to}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Atividade da tarefa: comentários em threads, histórico das mudanças e as duas
 * coisas na mesma linha do tempo. Cada aba pagina por cursor.
 */
export function ActivitySection({
  wsId,
  customId,
  members,
  statuses,
  tags,
  currentUserId,
  role,
  canWrite,
}: ActivitySectionProps) {
  const [tab, setTab] = useState<TabKey>('comments');
  const comments = useInfiniteQuery(commentsQuery(wsId, customId));
  const history = useInfiniteQuery({
    ...taskActivityQuery(wsId, customId),
    enabled: tab !== 'comments',
  });
  const actions = useComments(wsId, customId);

  const threads = useMemo(() => mergeThreadPages(comments.data?.pages), [comments.data?.pages]);
  const activities = useMemo(
    () => (history.data?.pages ?? []).flatMap((page) => page.items),
    [history.data?.pages],
  );

  const resolve = useMemo<ResolveName>(() => {
    const names = new Map<string, string>();

    for (const member of members) {
      names.set(member.userId.id, member.userId.name);
    }

    for (const status of statuses) {
      names.set(status.id, status.name);
    }

    for (const tag of tags) {
      names.set(tag.id, tag.name);
    }

    return (id) => names.get(id);
  }, [members, statuses, tags]);

  const threadProps = {
    wsId,
    members,
    currentUserId,
    role,
    canWrite,
    actions,
  };

  const commentList = (list: CommentThread[]) => (
    <ul className="flex flex-col gap-4">
      {list.map((thread) => (
        <CommentThreadItem key={thread.comment.id} thread={thread} {...threadProps} />
      ))}
    </ul>
  );

  const feed = useMemo(() => mergeFeed(threads, activities), [threads, activities]);

  return (
    <section aria-labelledby="task-activity-heading" className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-muted" aria-hidden="true" />
        <h2 id="task-activity-heading" className="text-[12.5px] font-semibold text-muted">
          Atividade
        </h2>
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value as TabKey);
        }}
      >
        <TabsList aria-label="Atividade da tarefa">
          {(Object.keys(TAB_LABEL) as TabKey[]).map((key) => (
            <TabsTrigger key={key} value={key}>
              {TAB_LABEL[key]}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="comments" className="flex flex-col gap-4">
          {canWrite ? (
            <CommentComposer
              wsId={wsId}
              members={members}
              label="Novo comentário"
              placeholder="Escreva um comentário… use @ para avisar alguém"
              submitLabel="Comentar"
              pending={actions.creating}
              onSubmit={(draft) => {
                void actions.create(draft);
              }}
            />
          ) : null}

          {comments.isPending ? <Spinner label="Carregando os comentários" /> : null}

          {!comments.isPending && threads.length === 0 ? (
            <p className="text-[13px] text-muted">
              Nenhum comentário ainda. Comece a conversa pela tarefa.
            </p>
          ) : null}

          {commentList(threads)}

          {comments.hasNextPage ? (
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              disabled={comments.isFetchingNextPage}
              onClick={() => {
                void comments.fetchNextPage();
              }}
            >
              {comments.isFetchingNextPage ? 'Carregando…' : 'Carregar comentários antigos'}
            </Button>
          ) : null}
        </TabsContent>

        <TabsContent value="history" className="flex flex-col gap-3">
          {history.isPending ? <Spinner label="Carregando o histórico" /> : null}

          {!history.isPending && activities.length === 0 ? (
            <p className="text-[13px] text-muted">Nada no histórico ainda.</p>
          ) : null}

          <ul className="flex flex-col gap-3">
            {activities.map((activity) => (
              <ActivityRow
                key={activity.id}
                activity={activity}
                members={members}
                resolve={resolve}
              />
            ))}
          </ul>

          {history.hasNextPage ? (
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              disabled={history.isFetchingNextPage}
              onClick={() => {
                void history.fetchNextPage();
              }}
            >
              {history.isFetchingNextPage ? 'Carregando…' : 'Carregar mais antigo'}
            </Button>
          ) : null}
        </TabsContent>

        <TabsContent value="all" className="flex flex-col gap-4">
          {comments.isPending || history.isPending ? <Spinner label="Carregando" /> : null}

          <ul className="flex flex-col gap-4">
            {feed.map((entry) =>
              entry.kind === 'comment' ? (
                <CommentThreadItem
                  key={`c-${entry.thread.comment.id}`}
                  thread={entry.thread}
                  {...threadProps}
                />
              ) : (
                <ActivityRow
                  key={`a-${entry.activity.id}`}
                  activity={entry.activity}
                  members={members}
                  resolve={resolve}
                />
              ),
            )}
          </ul>
        </TabsContent>
      </Tabs>
    </section>
  );
}
