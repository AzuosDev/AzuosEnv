import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CursorPage, paginateByIdDesc } from '../../common/pagination/cursor';
import { DEFAULT_PAGE_SIZE } from '../../common/pagination/pagination-query.dto';
import { PermissionContext } from '../hierarchy/permission.service';
import { MembersService } from '../workspaces/members.service';
import { ChatAccessService } from './chat-access.service';
import { ChannelLocationType, MAX_ACTIVITY_CHANNELS } from './chat-fields';
import { dmMemberIds, isOpenChannel } from './chat-rules';
import {
  ChannelMembersDto,
  ChannelQueryDto,
  CreateChannelDto,
  CreateDmDto,
  UpdateChannelDto,
} from './dto/channel.dto';
import { Channel, ChannelDocument } from './schemas/channel.schema';
import { ChannelRead, ChannelReadDocument } from './schemas/channel-read.schema';
import { Message } from './schemas/message.schema';

/** One line of the chat activity of the Sidebar Home. */
export interface ChannelActivity {
  channelId: string;
  type: string;
  name: string;
  unread: number;
  lastMessageAt: string | null;
  lastReadAt: string | null;
}

export interface ChatActivity {
  items: ChannelActivity[];
  /** Sum of the unread messages of every visible channel. */
  unread: number;
}

@Injectable()
export class ChannelsService {
  constructor(
    @InjectModel(Channel.name) private readonly model: Model<Channel>,
    @InjectModel(Message.name) private readonly messages: Model<Message>,
    @InjectModel(ChannelRead.name) private readonly reads: Model<ChannelRead>,
    private readonly access: ChatAccessService,
    private readonly members: MembersService,
  ) {}

  async create(ctx: PermissionContext, dto: CreateChannelDto): Promise<ChannelDocument> {
    const locationType = dto.locationType ?? 'workspace';
    const locationId = this.locationIdOf(locationType, dto.locationId);

    await this.access.requireLocation(ctx, locationType, locationId, 'edit');

    const memberIds = await this.requireMembers(ctx, dto.memberIds);

    return this.model.create({
      workspaceId: ctx.workspaceId,
      type: dto.type ?? 'channel',
      name: dto.name,
      locationType,
      locationId,
      private: dto.private ?? false,
      memberIds: this.withSelf(ctx, memberIds),
      createdBy: ctx.userId,
    });
  }

  /** A DM is unique per pair: the same two people always land on the same channel. */
  async getOrCreateDm(ctx: PermissionContext, dto: CreateDmDto): Promise<ChannelDocument> {
    const other = new Types.ObjectId(dto.userId);
    // Sorted pair, so the exact-array match finds the channel in both directions.
    const memberIds = dmMemberIds(ctx.userId, other);
    const [active] = await this.members.activeUserIds(ctx.workspaceId, [other]);

    if (!active) {
      throw this.invalidMembers();
    }
    const channel = await this.model
      .findOneAndUpdate(
        { workspaceId: ctx.workspaceId, type: 'dm', memberIds },
        {
          $setOnInsert: {
            workspaceId: ctx.workspaceId,
            type: 'dm',
            name: '',
            locationType: 'workspace',
            locationId: null,
            private: true,
            memberIds,
            createdBy: ctx.userId,
          },
        },
        { new: true, upsert: true },
      )
      .exec();

    return channel;
  }

  async list(ctx: PermissionContext, query: ChannelQueryDto): Promise<CursorPage<ChannelDocument>> {
    const filter: Record<string, unknown> = query.includeArchived ? {} : { archivedAt: null };

    if (query.locationType) {
      filter.locationType = query.locationType;
      filter.locationId = query.locationId ? new Types.ObjectId(query.locationId) : null;
    }

    const channels = await this.access.visibleChannels(ctx, filter);

    return paginateByIdDesc(channels, query.limit ?? DEFAULT_PAGE_SIZE, query.cursor);
  }

  get(ctx: PermissionContext, channelId: Types.ObjectId): Promise<ChannelDocument> {
    return this.access.requireChannel(ctx, channelId, 'view');
  }

  async update(
    ctx: PermissionContext,
    channelId: Types.ObjectId,
    dto: UpdateChannelDto,
  ): Promise<ChannelDocument> {
    const channel = await this.access.requireChannel(ctx, channelId, 'edit');

    this.access.requireChannelAdmin(ctx, channel);

    if (channel.type === 'dm') {
      throw this.invalidType();
    }

    if (dto.name !== undefined) {
      channel.name = dto.name;
    }

    if (dto.private !== undefined) {
      channel.private = dto.private;
    }

    return channel.save();
  }

  /** Archiving is how a channel is removed; the history stays readable. */
  async setArchived(
    ctx: PermissionContext,
    channelId: Types.ObjectId,
    archived: boolean,
  ): Promise<ChannelDocument> {
    const channel = await this.access.requireChannel(ctx, channelId, 'full');

    this.access.requireChannelAdmin(ctx, channel);

    channel.archivedAt = archived ? new Date() : null;

    return channel.save();
  }

  /** Only an open channel accepts anyone; a DM, a group and a private channel do not. */
  async join(ctx: PermissionContext, channelId: Types.ObjectId): Promise<ChannelDocument> {
    const channel = await this.access.requireChannel(ctx, channelId, 'view');

    if (!isOpenChannel(channel)) {
      throw this.access.channelNotFound();
    }

    if (!this.access.isMember(ctx, channel)) {
      channel.memberIds = [...channel.memberIds, ctx.userId];
      await channel.save();
    }

    return channel;
  }

  async leave(ctx: PermissionContext, channelId: Types.ObjectId): Promise<ChannelDocument> {
    const channel = await this.access.requireChannel(ctx, channelId, 'view');

    if (channel.type === 'dm') {
      throw this.invalidType();
    }

    channel.memberIds = channel.memberIds.filter((userId) => String(userId) !== String(ctx.userId));

    return channel.save();
  }

  async addMembers(
    ctx: PermissionContext,
    channelId: Types.ObjectId,
    dto: ChannelMembersDto,
  ): Promise<ChannelDocument> {
    const channel = await this.access.requireChannel(ctx, channelId, 'edit');

    this.access.requireChannelAdmin(ctx, channel);

    if (channel.type === 'dm') {
      throw this.invalidType();
    }

    const added = await this.requireMembers(ctx, dto.userIds);
    const current = new Set(channel.memberIds.map((userId) => String(userId)));

    channel.memberIds = [
      ...channel.memberIds,
      ...added.filter((userId) => !current.has(String(userId))),
    ];

    return channel.save();
  }

  async removeMember(
    ctx: PermissionContext,
    channelId: Types.ObjectId,
    userId: Types.ObjectId,
  ): Promise<ChannelDocument> {
    const channel = await this.access.requireChannel(ctx, channelId, 'edit');

    this.access.requireChannelAdmin(ctx, channel);

    if (channel.type === 'dm') {
      throw this.invalidType();
    }

    channel.memberIds = channel.memberIds.filter((member) => String(member) !== String(userId));

    return channel.save();
  }

  /** Marks the channel as read up to now, which zeroes its unread counter. */
  async markRead(ctx: PermissionContext, channelId: Types.ObjectId): Promise<ChannelReadDocument> {
    const channel = await this.access.requireChannel(ctx, channelId, 'view');
    const lastReadAt = new Date();

    return this.reads
      .findOneAndUpdate(
        { channelId: channel._id, userId: ctx.userId },
        { $set: { workspaceId: ctx.workspaceId, lastReadAt } },
        { new: true, upsert: true },
      )
      .exec();
  }

  /** Unread messages per visible channel, for the Sidebar Home. */
  async activity(ctx: PermissionContext): Promise<ChatActivity> {
    const channels = (await this.access.visibleChannels(ctx, { archivedAt: null })).slice(
      0,
      MAX_ACTIVITY_CHANNELS,
    );

    if (channels.length === 0) {
      return { items: [], unread: 0 };
    }

    const reads = await this.reads
      .find({ userId: ctx.userId, channelId: { $in: channels.map((one) => one._id) } })
      .exec();
    const readAt = new Map(reads.map((read) => [String(read.channelId), read.lastReadAt]));
    const items: ChannelActivity[] = [];
    let unread = 0;

    for (const channel of channels) {
      const lastReadAt = readAt.get(String(channel._id)) ?? null;
      const base = {
        workspaceId: ctx.workspaceId,
        channelId: channel._id,
        deletedAt: null,
      };
      const count = await this.messages.countDocuments(
        lastReadAt
          ? { ...base, authorId: { $ne: ctx.userId }, createdAt: { $gt: lastReadAt } }
          : { ...base, authorId: { $ne: ctx.userId } },
      );
      const last = await this.messages.findOne(base).sort({ _id: -1 }).select('createdAt').exec();
      const lastMessageAt = last?.get('createdAt') as Date | undefined;

      unread += count;
      items.push({
        channelId: String(channel._id),
        type: channel.type,
        name: channel.name,
        unread: count,
        lastMessageAt: lastMessageAt ? lastMessageAt.toISOString() : null,
        lastReadAt: lastReadAt ? lastReadAt.toISOString() : null,
      });
    }

    return { items, unread };
  }

  /** The creator always belongs to the channel they opened. */
  private withSelf(ctx: PermissionContext, memberIds: Types.ObjectId[]): Types.ObjectId[] {
    const ids = memberIds.filter((userId) => String(userId) !== String(ctx.userId));

    return [ctx.userId, ...ids];
  }

  /** Only active members of the workspace can be put in a channel. */
  private async requireMembers(
    ctx: PermissionContext,
    userIds: string[] | undefined,
  ): Promise<Types.ObjectId[]> {
    if (!userIds || userIds.length === 0) {
      return [];
    }

    const unique = [...new Set(userIds)].map((id) => new Types.ObjectId(id));
    const active = await this.members.activeUserIds(ctx.workspaceId, unique);

    if (active.length !== unique.length) {
      throw this.invalidMembers();
    }

    return active;
  }

  private locationIdOf(
    locationType: ChannelLocationType,
    locationId: string | undefined,
  ): Types.ObjectId | null {
    if (locationType === 'workspace') {
      return null;
    }

    if (!locationId) {
      throw new BadRequestException({
        code: 'INVALID_CHANNEL_LOCATION',
        message: 'Informe o local do canal.',
      });
    }

    return new Types.ObjectId(locationId);
  }

  private invalidMembers(): BadRequestException {
    return new BadRequestException({
      code: 'INVALID_CHANNEL_MEMBERS',
      message: 'Os participantes precisam ser membros ativos do workspace.',
    });
  }

  private invalidType(): BadRequestException {
    return new BadRequestException({
      code: 'INVALID_CHANNEL_TYPE',
      message: 'Esta operação não vale para este tipo de canal.',
    });
  }
}
