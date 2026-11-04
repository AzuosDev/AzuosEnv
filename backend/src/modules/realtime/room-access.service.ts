import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Types } from 'mongoose';
import { ChatAccessService } from '../chat/chat-access.service';
import { DocsAccessService } from '../docs/docs-access.service';
import { HierarchyAccessService } from '../hierarchy/hierarchy-access.service';
import { permissionContextFrom } from '../hierarchy/permission.service';
import { AccessTokenPayload } from '../auth/strategies/jwt.strategy';
import { TaskAccessService } from '../tasks/task-access.service';
import { UsersService } from '../users/users.service';
import { WhiteboardsAccessService } from '../whiteboards/whiteboards-access.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { RoomPayload, isRoomKind, roomName } from './realtime-rooms';

/** Authenticates the handshake and enforces the permission of each room. */
@Injectable()
export class RoomAccessService {
  constructor(
    private readonly jwt: JwtService,
    private readonly users: UsersService,
    private readonly workspaces: WorkspacesService,
    private readonly hierarchy: HierarchyAccessService,
    private readonly taskAccess: TaskAccessService,
    private readonly docs: DocsAccessService,
    private readonly chat: ChatAccessService,
    private readonly whiteboards: WhiteboardsAccessService,
  ) {}

  /** Reads the access token of `auth.token` and answers the id of the user. */
  async authenticate(token: unknown): Promise<string> {
    if (typeof token !== 'string' || token.length === 0) {
      throw this.unauthorized();
    }

    let payload: AccessTokenPayload;

    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw this.unauthorized();
    }

    const user = await this.users.findById(payload.sub);

    if (!user) {
      throw this.unauthorized();
    }

    return String(user._id);
  }

  /** Name of the room when the user may watch it; throws otherwise. */
  async resolve(userId: string, payload: RoomPayload): Promise<string> {
    const kind = payload.room;
    const id = payload.id;

    if (!isRoomKind(kind) || typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
      throw this.unauthorized();
    }

    if (kind === 'ws') {
      await this.workspaces.resolveContext(id, userId);

      return roomName('ws', id);
    }

    const wsId = typeof payload.wsId === 'string' ? payload.wsId : undefined;
    const resolved = await this.workspaces.resolveContext(wsId, userId);
    const ctx = permissionContextFrom(resolved.membership);

    if (kind === 'list') {
      const list = await this.hierarchy.requireList(ctx, new Types.ObjectId(id), 'view');

      return roomName('list', String(list._id));
    }

    if (kind === 'doc') {
      const doc = await this.docs.requireDoc(ctx, new Types.ObjectId(id), 'view');

      return roomName('doc', String(doc._id));
    }

    if (kind === 'board') {
      const board = await this.whiteboards.requireWhiteboard(ctx, new Types.ObjectId(id), 'view');

      return roomName('board', String(board._id));
    }

    if (kind === 'channel') {
      const channel = await this.chat.requireChannel(ctx, new Types.ObjectId(id), 'view');

      return roomName('channel', String(channel._id));
    }

    const { task } = await this.taskAccess.requireTask(ctx, id, 'view');

    return roomName('task', String(task._id));
  }

  private unauthorized(): UnauthorizedException {
    return new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Sessão inválida.' });
  }
}
