import { Types } from 'mongoose';
import type { MessageCreatedEvent } from '../chat/chat-events';
import type { NotificationCreatedEvent } from '../notifications/notification-events';
import { RealtimeListener } from './realtime.listener';
import { RealtimeService, RealtimeTransport, publicChannels } from './realtime.service';

interface Sent {
  channels: string[];
  event: string;
  data: Record<string, unknown>;
}

/** Transporte de teste: guarda o que foi publicado, sem rede nem socket. */
class FakeRealtime extends RealtimeService {
  readonly transport: RealtimeTransport = 'ably';
  readonly sent: Sent[] = [];

  publish(channels: string[], event: string, data: Record<string, unknown>): Promise<void> {
    this.sent.push({ channels, event, data });

    return Promise.resolve();
  }
}

const author = new Types.ObjectId();
const colleague = new Types.ObjectId();
const outsider = new Types.ObjectId();
const workspaceId = new Types.ObjectId();
const channelId = new Types.ObjectId();
const messageId = new Types.ObjectId();

function messageEvent(overrides: Partial<MessageCreatedEvent> = {}): MessageCreatedEvent {
  return {
    workspaceId,
    channelId,
    channelType: 'channel',
    channelName: 'geral',
    channelPrivate: true,
    messageId,
    parentMessageId: null,
    authorId: author,
    mentions: [colleague],
    memberIds: [author, colleague, outsider],
    preview: 'bom dia',
    ...overrides,
  };
}

describe('publicChannels', () => {
  it('deixa passar só canal que um cliente consegue assinar', () => {
    expect(
      publicChannels([
        'user:1',
        'ws:2',
        'channel:3',
        'task:4',
        'list:5',
        'doc:6',
        'board:7',
        'whatsapp:8',
      ]),
    ).toEqual(['user:1', 'ws:2', 'channel:3']);
  });

  it('não repete canal', () => {
    expect(publicChannels(['ws:1', 'ws:1', 'user:2'])).toEqual(['ws:1', 'user:2']);
  });
});

describe('RealtimeListener', () => {
  it('canal aberto: o resumo vai na sala do workspace, que toda aba assina', async () => {
    const transport = new FakeRealtime();
    const listener = new RealtimeListener(transport);

    await listener.onMessageCreated(messageEvent({ channelPrivate: false, memberIds: [] }));

    expect(transport.sent[1].event).toBe('channel.activity');
    expect(transport.sent[1].channels).toEqual([`ws:${String(workspaceId)}`]);
  });

  it('canal privado: o resumo vai à sala de cada membro menos o autor', async () => {
    const transport = new FakeRealtime();
    const listener = new RealtimeListener(transport);

    await listener.onMessageCreated(messageEvent());

    const [toChannel, toMembers] = transport.sent;

    expect(toChannel.event).toBe('message.new');
    expect(toChannel.channels).toEqual([`channel:${String(channelId)}`]);
    expect(toMembers.event).toBe('channel.activity');
    expect(toMembers.channels).toEqual([`user:${String(colleague)}`, `user:${String(outsider)}`]);
    expect(toMembers.channels).not.toContain(`user:${String(author)}`);
  });

  it('o resumo leva canal, autor e prévia: a lista e o badge andam sem buscar nada', async () => {
    const transport = new FakeRealtime();
    const listener = new RealtimeListener(transport);

    await listener.onMessageCreated(messageEvent());

    expect(transport.sent[1].data).toMatchObject({
      workspaceId: String(workspaceId),
      channelId: String(channelId),
      channelName: 'geral',
      channelType: 'channel',
      messageId: String(messageId),
      authorId: String(author),
      preview: 'bom dia',
      mentions: [String(colleague)],
    });
  });

  it('notificação nova vai só para a sala do dono', async () => {
    const transport = new FakeRealtime();
    const listener = new RealtimeListener(transport);
    const event: NotificationCreatedEvent = {
      workspaceId,
      notificationId: new Types.ObjectId(),
      userId: colleague,
      type: 'chatMessage',
      bucket: 'primary',
      entityType: 'message',
      entityId: messageId,
      actorId: author,
      data: {},
    };

    await listener.onNotificationCreated(event);

    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0].channels).toEqual([`user:${String(colleague)}`]);
    expect(transport.sent[0].event).toBe('notification.new');
  });
});
