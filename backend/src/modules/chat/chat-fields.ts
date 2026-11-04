/** A named channel, a direct message between two people or a private group. */
export const CHANNEL_TYPES = ['channel', 'dm', 'group'] as const;
export type ChannelType = (typeof CHANNEL_TYPES)[number];

/** Where a channel lives; `workspace` is the general chat, with no parent node. */
export const CHANNEL_LOCATION_TYPES = ['workspace', 'space', 'folder', 'list'] as const;
export type ChannelLocationType = (typeof CHANNEL_LOCATION_TYPES)[number];

export const MAX_CHANNEL_NAME_LENGTH = 120;

export const MAX_MESSAGE_TEXT_LENGTH = 20_000;

/** Members accepted in one call of the channel member endpoints. */
export const MAX_CHANNEL_MEMBERS = 200;

/** Attachments referenced by a single message. */
export const MAX_MESSAGE_ATTACHMENTS = 20;

/** Channels read before the permission filter in memory. */
export const MAX_CHANNEL_SCAN = 200;

/** Channels the chat activity endpoint counts unread messages for. */
export const MAX_ACTIVITY_CHANNELS = 100;

/** Characters of the message that become the name of the task. */
export const MAX_TASK_NAME_FROM_MESSAGE = 120;
