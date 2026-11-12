import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ChannelType } from './chat-fields';

/** The shape the open-channel rule needs; a document satisfies it. */
export interface ChannelShape {
  type: ChannelType;
  private: boolean;
}

/**
 * Members of a direct message, always in the same order, so the exact-array match
 * finds the existing conversation no matter who opens it.
 */
export function dmMemberIds(
  a: Types.ObjectId | string,
  b: Types.ObjectId | string,
): Types.ObjectId[] {
  if (String(a) === String(b)) {
    throw new BadRequestException({
      code: 'INVALID_CHANNEL_MEMBERS',
      message: 'Os participantes precisam ser membros ativos do workspace.',
    });
  }

  return [new Types.ObjectId(String(a)), new Types.ObjectId(String(b))].sort((one, other) =>
    String(one).localeCompare(String(other)),
  );
}

/** Only a public channel is open to every member of the workspace. */
export function isOpenChannel(channel: ChannelShape): boolean {
  return channel.type === 'channel' && !channel.private;
}
