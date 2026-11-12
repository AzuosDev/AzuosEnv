import { addDays, addHours, startOfDay } from 'date-fns';
import type { InboxTab, Notification, NotificationType } from '@/api/types';

export const INBOX_TABS: InboxTab[] = ['primary', 'other', 'later', 'cleared'];

export const INBOX_TAB_LABEL: Record<InboxTab, string> = {
  primary: 'Principal',
  other: 'Outros',
  later: 'Mais tarde',
  cleared: 'Limpas',
};

/** Frase da entrada: o que a pessoa fez, no lugar do nome do evento. */
export const NOTIFICATION_VERB: Record<NotificationType, string> = {
  assigned: 'atribuiu você a',
  mentioned: 'mencionou você em',
  commented: 'comentou em',
  statusChanged: 'mudou o status de',
  dueSoon: 'vence em menos de um dia',
  overdue: 'passou do prazo',
  reminder: 'é o seu lembrete de agora',
  invited: 'convidou você para',
  commentAssigned: 'atribuiu um comentário a você em',
  automation: 'mudou por uma automação',
  chatMention: 'mencionou você no chat',
  chatMessage: 'mandou mensagem no chat',
  formSubmitted: 'enviou um formulário em',
  aiSummary: 'resumo da IA sobre',
};

/** Entrada sem ator: a frase começa pela tarefa, não por nome de pessoa. */
export const SYSTEM_TYPES: NotificationType[] = ['dueSoon', 'overdue', 'reminder', 'automation'];

export interface NotificationCard {
  /** Texto que liga quem fez ao alvo (ou o alvo ao estado, no sistema). */
  verb: string;
  /** Tarefa que a entrada aponta, quando existe. */
  task: { customId: string; name: string; label: string } | null;
  /** Texto de apoio (nome do workspace, prévia da mensagem). */
  detail: string | null;
  /** Entrada que o sistema gerou sozinho. */
  system: boolean;
  /**
   * Frase com o alvo na frente ("AZD-142 Subir o PDV passou do prazo"), que é
   * como a entrada sem ator se lê.
   */
  targetFirst: boolean;
}

function text(data: Record<string, unknown>, key: string): string | null {
  const value = data[key];

  return typeof value === 'string' && value !== '' ? value : null;
}

/** Tudo que a linha do Inbox desenha, tirado só do `data` da notificação. */
export function describeNotification(notification: Notification): NotificationCard {
  const data = (notification.data ?? {}) as Record<string, unknown>;
  const customId = text(data, 'customId');
  const name = text(data, 'name') ?? customId;
  const system = SYSTEM_TYPES.includes(notification.type) || notification.actorId === null;

  return {
    verb: NOTIFICATION_VERB[notification.type],
    task: customId
      ? {
          customId,
          name: name ?? customId,
          // O id já identifica a tarefa: repetir o mesmo texto só suja a linha.
          label: name && name !== customId ? `${customId} ${name}` : customId,
        }
      : null,
    detail: text(data, 'workspaceName') ?? text(data, 'preview') ?? text(data, 'channelName'),
    system,
    // Só o verbo do sistema é predicado da tarefa; o resto precisa de sujeito.
    targetFirst: SYSTEM_TYPES.includes(notification.type) && customId !== null,
  };
}

export interface SnoozeChoice {
  key: string;
  label: string;
  /** Momento em que a entrada volta para a caixa, em UTC ISO. */
  until: string;
}

/** As três opções fixas de adiar; a quarta é a data escolhida à mão. */
export function snoozeChoices(now = new Date()): SnoozeChoice[] {
  const tomorrow = addHours(startOfDay(addDays(now, 1)), 9);
  const nextWeek = addHours(startOfDay(addDays(now, 7)), 9);

  return [
    { key: 'hour', label: 'Em 1 hora', until: addHours(now, 1).toISOString() },
    { key: 'tomorrow', label: 'Amanhã, 9h', until: tomorrow.toISOString() },
    { key: 'week', label: 'Próxima semana', until: nextWeek.toISOString() },
  ];
}

/** Junta as páginas do cursor em uma lista só. */
export function mergeNotificationPages(
  pages: { items: Notification[] }[] | undefined,
): Notification[] {
  return (pages ?? []).flatMap((page) => page.items);
}

export function isUnread(notification: Notification): boolean {
  return notification.readAt === null;
}

/** Título da aba do navegador com o contador de não lidas. */
export function titleWithBadge(title: string, unread: number): string {
  return unread > 0 ? `(${String(unread)}) ${title}` : title;
}
