/** Rooms a client can ask to join; `user:{id}` is joined on connect. */
export const ROOM_KINDS = ['ws', 'list', 'task', 'doc', 'channel'] as const;
export type RoomKind = (typeof ROOM_KINDS)[number];

export interface RoomPayload {
  room?: unknown;
  /** Id of the room: the workspace, the List, the task, the Doc or the channel. */
  id?: unknown;
  /** Workspace of the resource; ignored when `room` is `ws`. */
  wsId?: unknown;
}

export interface RoomAck {
  joined?: string;
  left?: string;
  code?: string;
}

/** Ephemeral typing signal of a channel; nothing is stored. */
export interface TypingPayload extends RoomPayload {
  typing?: unknown;
}

export function roomName(kind: RoomKind, id: string): string {
  return `${kind}:${id}`;
}

export function userRoom(userId: string): string {
  return `user:${userId}`;
}

export function isRoomKind(value: unknown): value is RoomKind {
  return typeof value === 'string' && (ROOM_KINDS as readonly string[]).includes(value);
}
