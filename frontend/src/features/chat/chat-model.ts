import type {
  Channel,
  ChannelActivity,
  ChatActivity,
  Message,
  WorkspaceMemberItem,
  WorkspaceRole,
} from '@/api/types';

/** Emojis oferecidos no botão de reagir da mensagem. */
export const QUICK_REACTIONS = ['👍', '🎉', '👀', '✅', '❤️', '🚀'] as const;

/** Minutos entre duas mensagens do mesmo autor que ainda ficam no mesmo bloco. */
export const GROUP_WINDOW_MINUTES = 5;

interface Page<T> {
  items: T[];
}

/**
 * Mensagens das páginas carregadas em ordem crescente de tempo. A API devolve
 * as raízes das mais novas para as mais antigas e cada página seguinte é mais
 * antiga, então o achatamento inverte as duas dimensões.
 */
export function mergeMessagePages(pages: Page<Message>[] | undefined): Message[] {
  return (pages ?? [])
    .flatMap((page) => page.items)
    .slice()
    .reverse();
}

/** Respostas da thread já vêm das mais antigas para as mais novas. */
export function mergeReplyPages(pages: Page<Message>[] | undefined): Message[] {
  return (pages ?? []).flatMap((page) => page.items);
}

export interface MessageBlock {
  /** Chave estável do bloco: a primeira mensagem dele. */
  id: string;
  authorId: string;
  /** Dia do bloco em ISO curto (yyyy-MM-dd), no fuso do navegador. */
  day: string;
  items: Message[];
}

export interface MessageDay {
  day: string;
  blocks: MessageBlock[];
}

function dayKey(iso: string): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const dayOfMonth = String(date.getDate()).padStart(2, '0');

  return `${String(date.getFullYear())}-${month}-${dayOfMonth}`;
}

function minutesBetween(a: string, b: string): number {
  const first = new Date(a).getTime();
  const second = new Date(b).getTime();

  if (Number.isNaN(first) || Number.isNaN(second)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.abs(second - first) / 60_000;
}

/**
 * Agrupa as mensagens por dia e, dentro do dia, por autor em sequência: só a
 * primeira do bloco mostra avatar e nome.
 */
export function groupMessages(messages: Message[]): MessageDay[] {
  const days: MessageDay[] = [];

  for (const message of messages) {
    const day = dayKey(message.createdAt);
    let current = days.at(-1);

    if (!current || current.day !== day) {
      current = { day, blocks: [] };
      days.push(current);
    }

    const block = current.blocks.at(-1);
    const last = block?.items.at(-1);

    if (
      block &&
      last &&
      block.authorId === String(message.authorId) &&
      minutesBetween(last.createdAt, message.createdAt) <= GROUP_WINDOW_MINUTES
    ) {
      block.items.push(message);

      continue;
    }

    current.blocks.push({
      id: message.id,
      authorId: String(message.authorId),
      day,
      items: [message],
    });
  }

  return days;
}

export interface ReactionState {
  emoji: string;
  count: number;
  /** Se o usuário autenticado é um dos que reagiram. */
  mine: boolean;
}

export function messageReactions(message: Message, userId: string | undefined): ReactionState[] {
  return message.reactions
    .filter((reaction) => reaction.userIds.length > 0)
    .map((reaction) => ({
      emoji: reaction.emoji,
      count: reaction.userIds.length,
      mine: userId ? reaction.userIds.some((id) => String(id) === userId) : false,
    }));
}

export function isAuthor(message: Message, userId: string | undefined): boolean {
  return Boolean(userId) && String(message.authorId) === userId;
}

/** Canal aberto a todo o workspace: público e não privado. */
export function isOpenChannel(channel: Channel): boolean {
  return channel.type === 'channel' && !channel.private;
}

export function isChannelMember(channel: Channel, userId: string | undefined): boolean {
  return channel.memberIds.map(String).includes(String(userId ?? ''));
}

/**
 * Quem escreve no canal: papel interno e, em canal privado, grupo ou DM, só
 * quem participa. Convidado fica só leitura, como no painel da tarefa.
 */
export function canWriteChannel(
  channel: Channel,
  role: WorkspaceRole,
  userId: string | undefined,
): boolean {
  return role !== 'guest' && (isOpenChannel(channel) || isChannelMember(channel, userId));
}

/** Quem administra o canal: owner, admin ou quem o criou. */
export function canManageChannel(
  channel: Channel,
  role: WorkspaceRole,
  userId: string | undefined,
): boolean {
  return role === 'owner' || role === 'admin' || String(channel.createdBy) === String(userId ?? '');
}

/** Editar é só do autor; excluir também aceita quem administra o workspace. */
export function canDeleteMessage(
  message: Message,
  userId: string | undefined,
  role: WorkspaceRole,
): boolean {
  return isAuthor(message, userId) || role === 'owner' || role === 'admin';
}

/* Cache das mensagens ---------------------------------------------------- */

/**
 * Põe a mensagem nova na primeira página, que é a das mais recentes. Mensagem
 * que já está carregada não entra de novo (o autor vê a resposta da API e o
 * evento do socket).
 */
export function prependMessage<P extends Page<Message>>(pages: P[], message: Message): P[] {
  if (pages.length === 0) {
    return pages;
  }

  if (pages.some((page) => page.items.some((item) => item.id === message.id))) {
    return pages;
  }

  return pages.map((page, index) =>
    index === 0 ? { ...page, items: [message, ...page.items] } : page,
  );
}

/** Põe a resposta no fim da última página da thread, que é a mais nova. */
export function appendReply<P extends Page<Message>>(pages: P[], message: Message): P[] {
  if (pages.length === 0) {
    return pages;
  }

  if (pages.some((page) => page.items.some((item) => item.id === message.id))) {
    return pages;
  }

  const last = pages.length - 1;

  return pages.map((page, index) =>
    index === last ? { ...page, items: [...page.items, message] } : page,
  );
}

export function replaceMessage<P extends Page<Message>>(pages: P[], message: Message): P[] {
  return pages.map((page) => ({
    ...page,
    items: page.items.map((item) => (item.id === message.id ? message : item)),
  }));
}

export function removeMessage<P extends Page<Message>>(pages: P[], messageId: string): P[] {
  return pages.map((page) => ({
    ...page,
    items: page.items.filter((item) => item.id !== messageId),
  }));
}

/* Canais ----------------------------------------------------------------- */

export function memberUser(members: WorkspaceMemberItem[], userId: string | null | undefined) {
  return members.find((member) => member.userId.id === String(userId ?? ''))?.userId;
}

/** O outro participante de uma DM, de quem a conversa toma o nome. */
export function dmPartnerId(channel: Channel, currentUserId: string | undefined): string | null {
  const other = channel.memberIds
    .map(String)
    .find((userId) => userId !== String(currentUserId ?? ''));

  return other ?? (channel.memberIds[0] ? String(channel.memberIds[0]) : null);
}

/** Nome que a lateral mostra: a DM é nomeada pela outra pessoa. */
export function channelTitle(
  channel: Channel,
  members: WorkspaceMemberItem[],
  currentUserId: string | undefined,
): string {
  if (channel.type !== 'dm') {
    return channel.name;
  }

  const partner = memberUser(members, dmPartnerId(channel, currentUserId));

  return partner?.name ?? 'Conversa direta';
}

export interface ChannelGroups {
  channels: Channel[];
  dms: Channel[];
}

/** Canais e grupos de um lado, conversas diretas do outro. */
export function splitChannels(channels: Channel[]): ChannelGroups {
  return {
    channels: channels.filter((channel) => channel.type !== 'dm'),
    dms: channels.filter((channel) => channel.type === 'dm'),
  };
}

/** Não lidas de um canal a partir da atividade do chat. */
export function unreadOf(activity: ChatActivity | undefined, channelId: string): number {
  return activity?.items.find((item) => item.channelId === channelId)?.unread ?? 0;
}

export function activityOf(
  activity: ChatActivity | undefined,
  channelId: string,
): ChannelActivity | undefined {
  return activity?.items.find((item) => item.channelId === channelId);
}

/**
 * Canais na ordem da conversa: quem tem mensagem mais nova primeiro, e canal
 * sem mensagem depois, pela ordem que a API devolveu.
 */
export function sortByLastMessage(
  channels: Channel[],
  activity: ChatActivity | undefined,
): Channel[] {
  const at = (channel: Channel): number => {
    const stamp = activityOf(activity, channel.id)?.lastMessageAt;

    return stamp ? new Date(stamp).getTime() : 0;
  };

  return channels.slice().sort((one, other) => at(other) - at(one));
}

/** Frase do "digitando…" com os nomes de quem está escrevendo agora. */
export function typingLabel(names: string[]): string {
  if (names.length === 0) {
    return '';
  }

  if (names.length === 1) {
    return `${names[0] ?? ''} está digitando…`;
  }

  if (names.length === 2) {
    return `${names[0] ?? ''} e ${names[1] ?? ''} estão digitando…`;
  }

  return 'Várias pessoas estão digitando…';
}

/** Primeiros caracteres da mensagem, para o título do canal e os avisos. */
export function messagePreview(message: Message, max = 80): string {
  const text = message.bodyText.replace(/\s+/g, ' ').trim();

  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
