import { Link } from '@tanstack/react-router';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BellRing, Check, Clock, MoreHorizontal, X } from 'lucide-react';
import type { InboxTab, Notification, WorkspaceMemberItem } from '@/api/types';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { describeNotification, isUnread, snoozeChoices } from '../notification-model';

export interface NotificationRowProps {
  wsId: string;
  tab: InboxTab;
  notification: Notification;
  members: WorkspaceMemberItem[];
  onRead: (read: boolean) => void;
  onSnooze: (until: string, label: string) => void;
  onSnoozePick: () => void;
  onClear: () => void;
}

/** "há 4 minutos", no fuso do navegador. */
function relative(iso: string): string {
  const date = new Date(iso);

  return Number.isNaN(date.getTime())
    ? ''
    : formatDistanceToNow(date, { locale: ptBR, addSuffix: true });
}

/** Uma entrada do Inbox: quem fez o quê, onde, quando, e o que dá para fazer. */
export function NotificationRow({
  wsId,
  tab,
  notification,
  members,
  onRead,
  onSnooze,
  onSnoozePick,
  onClear,
}: NotificationRowProps) {
  const card = describeNotification(notification);
  const unread = isUnread(notification);
  const actor = members.find((member) => member.userId.id === notification.actorId)?.userId;
  const actorName = card.system ? 'Azuos Env' : (actor?.name ?? 'Alguém');
  const choices = snoozeChoices();
  const link = card.task ? (
    <Link
      to="/w/$wsId/t/$customId"
      params={{ wsId, customId: card.task.customId }}
      onClick={() => {
        if (unread) {
          onRead(true);
        }
      }}
      className="font-medium text-accent underline decoration-accent/40 underline-offset-[3px]"
    >
      {card.task.label}
    </Link>
  ) : null;

  return (
    <li
      className={cn(
        'group flex items-start gap-3 border-b border-line px-2 py-3 last:border-b-0 md:px-3',
        unread && 'bg-surface-2/40',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'mt-3.5 h-2 w-2 shrink-0 rounded-full',
          unread ? 'bg-accent' : 'bg-transparent',
        )}
      />
      <span className="sr-only">{unread ? 'Não lida' : 'Lida'}</span>

      {card.system ? (
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-scene-line bg-scene text-accent"
        >
          <BellRing className="h-4 w-4" aria-hidden="true" />
        </span>
      ) : (
        <Avatar name={actorName} src={actor?.avatarUrl} className="mt-0.5 h-8 w-8 shrink-0" />
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-[13.5px] text-body">
          {card.targetFirst ? (
            <>
              {link} {card.verb}
            </>
          ) : (
            <>
              <span className="font-semibold text-ink">{actorName}</span> {card.verb}{' '}
              {link ?? <span className="text-ink">{card.detail ?? 'este workspace'}</span>}
            </>
          )}
        </p>

        {card.task && card.detail ? (
          <span className="truncate rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-body">
            {card.detail}
          </span>
        ) : null}

        <span className="text-[12px] text-muted">{relative(notification.createdAt)}</span>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="nav"
          size="icon"
          className="h-10 w-10 md:h-9 md:w-9"
          aria-label={unread ? 'Marcar como lida' : 'Marcar como não lida'}
          onClick={() => {
            onRead(unread);
          }}
        >
          {unread ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Clock className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="nav"
              size="icon"
              className="h-10 w-10 md:h-9 md:w-9"
              aria-label={`Ações da notificação de ${actorName}`}
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {choices.map((choice) => (
              <DropdownMenuItem
                key={choice.key}
                onSelect={() => {
                  onSnooze(choice.until, choice.label);
                }}
              >
                Adiar · {choice.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onSelect={onSnoozePick}>Adiar para uma data…</DropdownMenuItem>
            {tab === 'cleared' ? null : (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onClear}>
                  <X className="mr-2 h-4 w-4" aria-hidden="true" />
                  Limpar
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
