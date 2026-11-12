import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UpdateNotificationSettingsDto } from './dto/notification-settings.dto';
import {
  NOTIFICATION_TYPES,
  NotificationPreferences,
  NotificationType,
  defaultPreferences,
} from './notification-fields';
import { NotificationSetting } from './schemas/notification-setting.schema';

@Injectable()
export class NotificationSettingsService {
  constructor(
    @InjectModel(NotificationSetting.name) private readonly model: Model<NotificationSetting>,
  ) {}

  async get(userId: Types.ObjectId): Promise<NotificationPreferences> {
    const doc = await this.model.findOne({ userId }).exec();

    return merge(doc?.types);
  }

  /** Preferences of many recipients in one read, keyed by user id. */
  async forUsers(userIds: Types.ObjectId[]): Promise<Map<string, NotificationPreferences>> {
    if (userIds.length === 0) {
      return new Map();
    }

    const docs = await this.model.find({ userId: { $in: userIds } }).exec();
    const stored = new Map(docs.map((doc) => [String(doc.userId), doc.types]));

    return new Map(userIds.map((id) => [String(id), merge(stored.get(String(id)))]));
  }

  /** Partial update: only the types present in the payload are touched. */
  async update(
    userId: Types.ObjectId,
    dto: UpdateNotificationSettingsDto,
  ): Promise<NotificationPreferences> {
    const current = await this.get(userId);

    for (const type of NOTIFICATION_TYPES) {
      const change = dto.types[type];

      if (!change) {
        continue;
      }

      current[type] = {
        inbox: change.inbox ?? current[type].inbox,
        email: change.email ?? current[type].email,
      };
    }

    await this.model
      .updateOne(
        { userId },
        { $set: { types: current }, $setOnInsert: { _id: new Types.ObjectId() } },
        { upsert: true },
      )
      .exec();

    return current;
  }
}

function merge(stored: Record<string, unknown> | undefined): NotificationPreferences {
  const preferences = defaultPreferences();

  for (const type of NOTIFICATION_TYPES) {
    const channels = stored?.[type] as Partial<NotificationPreferences[NotificationType]>;

    if (channels) {
      preferences[type] = {
        inbox: channels.inbox ?? preferences[type].inbox,
        email: channels.email ?? preferences[type].email,
      };
    }
  }

  return preferences;
}
