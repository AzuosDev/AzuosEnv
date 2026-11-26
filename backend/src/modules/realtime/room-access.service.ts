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
import { WhatsappAccessService } from '../whatsapp/whatsapp-access.service';
import { WhiteboardsAccessService } from '../whiteboards/whiteboards-access.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import type { RealtimeCapability } from './ably.realtime';
import { RoomPayload, isRoomKind, roomName, userRoom } from './realtime-rooms';

/** Teto de workspaces considerados no token; ninguém participa de mais. */
const WORKSPACE_LIMIT = 50;

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
    private readonly whatsapp: WhatsappAccessService,
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

  /**
   * Canais que este usuário pode ouvir, no formato de capacidade do Ably: a
   * própria sala, cada workspace ativo e cada canal de chat visível nele. É a
   * mesma permissão do `resolve`, só calculada de uma vez — com o token
   * recortado, canal de terceiro é recusado pelo serviço, não por nós.
   */
  async subscribeCapability(userId: string): Promise<RealtimeCapability> {
    const capability: RealtimeCapability = { [userRoom(userId)]: ['subscribe'] };
    const workspaces = await this.workspaces.listForUser(userId, { limit: WORKSPACE_LIMIT });

    for (const workspace of workspaces.items) {
      const wsId = String(workspace._id);

      capability[roomName('ws', wsId)] = ['subscribe'];

      const resolved = await this.workspaces.resolveContext(wsId, userId);
      const channelIds = await this.chat.visibleChannelIds(
        permissionContextFrom(resolved.membership),
      );

      for (const channelId of channelIds) {
        capability[roomName('channel', String(channelId))] = ['subscribe'];
      }
    }

    return capability;
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

    // The whatsapp room is per workspace and only reaches who has the module.
    if (kind === 'whatsapp') {
      const resolved = await this.workspaces.resolveContext(id, userId);

      await this.whatsapp.require(permissionContextFrom(resolved.membership), 'atendente');

      return roomName('whatsapp', id);
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
