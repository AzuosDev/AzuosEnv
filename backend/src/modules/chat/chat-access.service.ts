import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { HierarchyAccessService } from '../hierarchy/hierarchy-access.service';
import { PermissionLevel, hasLevelAtLeast } from '../hierarchy/permission-levels';
import { PermissionContext, PermissionService } from '../hierarchy/permission.service';
import { hasRoleAtLeast } from '../workspaces/workspace-roles';
import { ChannelLocationType, MAX_CHANNEL_SCAN } from './chat-fields';
import { isOpenChannel } from './chat-rules';
import { Channel, ChannelDocument } from './schemas/channel.schema';
import { Message, MessageDocument } from './schemas/message.schema';

export interface MessageWithChannel {
  message: MessageDocument;
  channel: ChannelDocument;
}

/**
 * Loads channels and messages, resolves the permission of the location the channel
 * lives in and hides what the requester cannot see. A private channel, a DM and a
 * group belong to their members only.
 */
@Injectable()
export class ChatAccessService {
  constructor(
    @InjectModel(Channel.name) private readonly channels: Model<Channel>,
    @InjectModel(Message.name) private readonly messages: Model<Message>,
    private readonly hierarchy: HierarchyAccessService,
    private readonly permissions: PermissionService,
  ) {}

  channelNotFound(): NotFoundException {
    return new NotFoundException({ code: 'CHANNEL_NOT_FOUND', message: 'Canal não encontrado.' });
  }

  messageNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'MESSAGE_NOT_FOUND',
      message: 'Mensagem não encontrada.',
    });
  }

  /** Level of the requester over the location; `workspace` is open to members. */
  async locationLevel(
    ctx: PermissionContext,
    locationType: ChannelLocationType,
    locationId: Types.ObjectId | null,
  ): Promise<PermissionLevel | null> {
    if (locationType === 'workspace' || !locationId) {
      return hasRoleAtLeast(ctx.role, 'member') ? 'full' : null;
    }

    return this.chainLevel(ctx, locationType, locationId);
  }

  /** Enforces `required` over the location of a channel that is about to be created. */
  async requireLocation(
    ctx: PermissionContext,
    locationType: ChannelLocationType,
    locationId: Types.ObjectId | null,
    required: PermissionLevel,
  ): Promise<void> {
    const level = await this.locationLevel(ctx, locationType, locationId);

    this.permissions.assertLevel(level, required, () => this.channelNotFound());
  }

  /** The channel plus the permission to use it at `required`. */
  async requireChannel(
    ctx: PermissionContext,
    channelId: Types.ObjectId,
    required: PermissionLevel,
  ): Promise<ChannelDocument> {
    const channel = await this.channels
      .findOne({ _id: channelId, workspaceId: ctx.workspaceId })
      .exec();

    if (!channel || !this.visibleToMember(ctx, channel)) {
      throw this.channelNotFound();
    }

    await this.requireLocation(ctx, channel.locationType, channel.locationId, required);

    return channel;
  }

  /** The message plus its channel, with the level enforced over the channel. */
  async requireMessage(
    ctx: PermissionContext,
    messageId: Types.ObjectId,
    required: PermissionLevel,
  ): Promise<MessageWithChannel> {
    const message = await this.messages
      .findOne({ _id: messageId, workspaceId: ctx.workspaceId, deletedAt: null })
      .exec();

    if (!message) {
      throw this.messageNotFound();
    }

    try {
      return { message, channel: await this.requireChannel(ctx, message.channelId, required) };
    } catch (error) {
      throw error instanceof NotFoundException ? this.messageNotFound() : error;
    }
  }

  /** A DM, a group or a private channel only accepts writes from its members. */
  requireMembership(ctx: PermissionContext, channel: ChannelDocument): void {
    if (isOpenChannel(channel)) {
      return;
    }

    if (!this.isMember(ctx, channel)) {
      throw new ForbiddenException({
        code: 'CHANNEL_MEMBER_REQUIRED',
        message: 'Você não participa deste canal.',
      });
    }
  }

  /** Only the creator of the channel or an admin of the workspace manage members. */
  requireChannelAdmin(ctx: PermissionContext, channel: ChannelDocument): void {
    if (hasRoleAtLeast(ctx.role, 'admin') || String(channel.createdBy) === String(ctx.userId)) {
      return;
    }

    throw new ForbiddenException({
      code: 'FORBIDDEN_CHANNEL',
      message: 'Somente quem criou o canal pode alterá-lo.',
    });
  }

  isMember(ctx: PermissionContext, channel: ChannelDocument): boolean {
    return channel.memberIds.some((userId) => String(userId) === String(ctx.userId));
  }

  /** Channels matching the filter that the requester can at least see, newest first. */
  async visibleChannels(
    ctx: PermissionContext,
    filter: Record<string, unknown> = {},
  ): Promise<ChannelDocument[]> {
    const channels = await this.channels
      .find({ workspaceId: ctx.workspaceId, ...filter })
      .sort({ _id: -1 })
      .limit(MAX_CHANNEL_SCAN)
      .exec();

    return this.filterVisible(ctx, channels);
  }

  /** Same filter as `visibleChannels`, keeping the order the caller already has. */
  async filterVisible(
    ctx: PermissionContext,
    channels: ChannelDocument[],
  ): Promise<ChannelDocument[]> {
    const cache = new Map<string, boolean>();
    const visible: ChannelDocument[] = [];

    for (const channel of channels) {
      if (!this.visibleToMember(ctx, channel)) {
        continue;
      }

      const key = `${channel.locationType}:${String(channel.locationId)}`;
      let allowed = cache.get(key);

      if (allowed === undefined) {
        allowed = hasLevelAtLeast(
          await this.locationLevel(ctx, channel.locationType, channel.locationId),
          'view',
        );
        cache.set(key, allowed);
      }

      if (allowed) {
        visible.push(channel);
      }
    }

    return visible;
  }

  /** Ids of the visible channels, used by the global search over messages. */
  async visibleChannelIds(ctx: PermissionContext): Promise<Types.ObjectId[]> {
    const channels = await this.visibleChannels(ctx);

    return channels.map((channel) => channel._id);
  }

  private visibleToMember(ctx: PermissionContext, channel: ChannelDocument): boolean {
    return isOpenChannel(channel) || this.isMember(ctx, channel);
  }

  private async chainLevel(
    ctx: PermissionContext,
    locationType: ChannelLocationType,
    locationId: Types.ObjectId,
  ): Promise<PermissionLevel | null> {
    try {
      if (locationType === 'space') {
        const space = await this.hierarchy.requireSpace(ctx, locationId, 'view');

        return this.permissions.levelFor(ctx, this.hierarchy.spaceChain(space));
      }

      if (locationType === 'folder') {
        const folder = await this.hierarchy.requireFolder(ctx, locationId, 'view');

        return this.permissions.levelFor(ctx, await this.hierarchy.folderChain(folder));
      }

      const list = await this.hierarchy.requireList(ctx, locationId, 'view');

      return this.permissions.levelFor(ctx, await this.hierarchy.listChain(list));
    } catch {
      return null;
    }
  }
}
