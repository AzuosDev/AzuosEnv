/** Rooms a client can ask to join; `user:{id}` is joined on connect. */
export const ROOM_KINDS = ['ws', 'list', 'task'] as const;
export type RoomKind = (typeof ROOM_KINDS)[number];

export interface RoomPayload {
  room?: unknown;
  /** Id of the room: the workspace, the List or the task. */
  id?: unknown;
  /** Workspace of the List or of the task; ignored when `room` is `ws`. */
  wsId?: unknown;
}

export interface RoomAck {
  joined?: string;
  left?: string;
  code?: string;
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
