import { Hash, MessageSquarePlus, Plus } from 'lucide-react';
import type { Channel, ChatActivity, WorkspaceMemberItem } from '@/api/types';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { channelTitle, memberUser, dmPartnerId, sortByLastMessage, unreadOf } from '../chat-model';

export interface ChannelListProps {
  channels: Channel[];
  dms: Channel[];
  activity: ChatActivity | undefined;
  members: WorkspaceMemberItem[];
  currentUserId: string | undefined;
  activeId: string | null;
  /** Falso em convidado: criar canal e abrir DM não aparecem. */
  canCreate: boolean;
  onPick: (channelId: string) => void;
  onNewChannel: () => void;
  onNewDm: () => void;
}

const sectionLabel = 'px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted';

function UnreadBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-on-signal">
      {count > 99 ? '99+' : count}
      <span className="sr-only"> não lidas</span>
    </span>
  );
}

function Row({
  channel,
  label,
  unread,
  active,
  avatar,
  onPick,
}: {
  channel: Channel;
  label: string;
  unread: number;
  active: boolean;
  avatar: { name: string; src?: string | null } | null;
  onPick: (channelId: string) => void;
}) {
  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-11 items-center gap-2 rounded-lg px-2 text-left text-[13px]',
        active
          ? 'bg-accent/15 font-semibold text-ink'
          : 'text-body hover:bg-surface-2 hover:text-ink',
      )}
      onClick={() => {
        onPick(channel.id);
      }}
    >
      {avatar ? (
        <Avatar name={avatar.name} src={avatar.src} className="h-6 w-6 shrink-0" />
      ) : (
        <Hash className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
      )}
      <span className={cn('min-w-0 flex-1 truncate', unread > 0 && 'font-semibold text-ink')}>
        {label}
      </span>
      {unread > 0 ? <UnreadBadge count={unread} /> : null}
    </button>
  );
}

/** Canais e conversas diretas com as não lidas, ordenados pela última mensagem. */
export function ChannelList({
  channels,
  dms,
  activity,
  members,
  currentUserId,
  activeId,
  canCreate,
  onPick,
  onNewChannel,
  onNewDm,
}: ChannelListProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2 py-3">
      <nav aria-label="Canais" className="flex flex-col">
        <div className="flex items-center justify-between">
          <span className={sectionLabel}>Canais</span>
          {canCreate ? (
            <Button variant="nav" size="icon" aria-label="Novo canal" onClick={onNewChannel}>
              <Plus className="h-4 w-4" aria-hidden="true" />
            </Button>
          ) : null}
        </div>

        {sortByLastMessage(channels, activity).map((channel) => (
          <Row
            key={channel.id}
            channel={channel}
            label={channelTitle(channel, members, currentUserId)}
            unread={unreadOf(activity, channel.id)}
            active={channel.id === activeId}
            avatar={null}
            onPick={onPick}
          />
        ))}

        {channels.length === 0 ? (
          <p className="px-2 py-1 text-[12.5px] text-muted">Nenhum canal ainda.</p>
        ) : null}
      </nav>

      <nav aria-label="Mensagens diretas" className="flex flex-col">
        <div className="flex items-center justify-between">
          <span className={sectionLabel}>Mensagens diretas</span>
          {canCreate ? (
            <Button variant="nav" size="icon" aria-label="Nova conversa" onClick={onNewDm}>
              <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
            </Button>
          ) : null}
        </div>

        {sortByLastMessage(dms, activity).map((channel) => {
          const partner = memberUser(members, dmPartnerId(channel, currentUserId));

          return (
            <Row
              key={channel.id}
              channel={channel}
              label={channelTitle(channel, members, currentUserId)}
              unread={unreadOf(activity, channel.id)}
              active={channel.id === activeId}
              avatar={{ name: partner?.name ?? 'Pessoa', src: partner?.avatarUrl ?? null }}
              onPick={onPick}
            />
          );
        })}

        {dms.length === 0 ? (
          <p className="px-2 py-1 text-[12.5px] text-muted">Nenhuma conversa ainda.</p>
        ) : null}
      </nav>
    </div>
  );
}
