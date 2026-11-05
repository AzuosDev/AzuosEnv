import type { NotificationKind } from '@/api/types';

/** Tipos de notificação na ordem da matriz, com o rótulo que o usuário lê. */
export const NOTIFICATION_KINDS: { id: NotificationKind; label: string }[] = [
  { id: 'assigned', label: 'Tarefa atribuída a mim' },
  { id: 'mentioned', label: 'Menção em comentário' },
  { id: 'commented', label: 'Comentário em tarefa que sigo' },
  { id: 'commentAssigned', label: 'Comentário atribuído a mim' },
  { id: 'statusChanged', label: 'Mudança de status' },
  { id: 'dueSoon', label: 'Prazo chegando' },
  { id: 'overdue', label: 'Prazo vencido' },
  { id: 'reminder', label: 'Lembrete' },
  { id: 'invited', label: 'Convite para workspace' },
  { id: 'automation', label: 'Automação' },
  { id: 'chatMention', label: 'Menção no chat' },
  { id: 'chatMessage', label: 'Mensagem no chat' },
  { id: 'formSubmitted', label: 'Formulário recebido' },
  { id: 'aiSummary', label: 'Resumo da IA' },
];

export const NOTIFICATION_CHANNELS: { id: 'inbox' | 'email'; label: string }[] = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'email', label: 'E-mail' },
];
