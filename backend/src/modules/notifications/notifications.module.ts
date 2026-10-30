import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MailModule } from '../mail/mail.module';
import { TasksDataModule } from '../tasks/tasks-data.module';
import { TasksModule } from '../tasks/tasks.module';
import { UsersModule } from '../users/users.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { NotificationSettingsService } from './notification-settings.service';
import { InboxController, NotificationSettingsController } from './notifications.controller';
import { NotificationsListener } from './notifications.listener';
import { NotificationsScheduler } from './notifications.scheduler';
import { NotificationsService } from './notifications.service';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';
import {
  NotificationSetting,
  NotificationSettingSchema,
} from './schemas/notification-setting.schema';
import { Notification, NotificationSchema } from './schemas/notification.schema';
import { Reminder, ReminderSchema } from './schemas/reminder.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: NotificationSetting.name, schema: NotificationSettingSchema },
      { name: Reminder.name, schema: ReminderSchema },
    ]),
    TasksDataModule,
    TasksModule,
    WorkspacesModule,
    UsersModule,
    MailModule,
  ],
  controllers: [InboxController, NotificationSettingsController, RemindersController],
  providers: [
    NotificationsService,
    NotificationSettingsService,
    RemindersService,
    NotificationsListener,
    NotificationsScheduler,
  ],
  exports: [NotificationsService, NotificationsScheduler, RemindersService],
})
export class NotificationsModule {}
