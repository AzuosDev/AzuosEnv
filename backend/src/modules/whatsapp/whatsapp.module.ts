import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AiModule } from '../ai/ai.module';
import { HierarchyModule } from '../hierarchy/hierarchy.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SecretsModule } from '../secrets/secrets.module';
import { StorageModule } from '../storage/storage.module';
import { TasksModule } from '../tasks/tasks.module';
import { Workspace, WorkspaceSchema } from '../workspaces/schemas/workspace.schema';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { MetaGraphProvider } from './graph/meta-graph.provider';
import { MockWhatsappGraphProvider } from './graph/mock-graph.provider';
import { WhatsappGraphProvider } from './graph/whatsapp-graph.provider';
import { WhatsappDataModule } from './whatsapp-data.module';
import { WhatsappBotSettingsService } from './whatsapp-bot-settings.service';
import { WhatsappBotService } from './whatsapp-bot.service';
import { WhatsappConnectionsService } from './whatsapp-connections.service';
import { WhatsappContactsService } from './whatsapp-contacts.service';
import { WhatsappConversationsService } from './whatsapp-conversations.service';
import { WhatsappMessagesService } from './whatsapp-messages.service';
import { WhatsappMetricsService } from './whatsapp-metrics.service';
import { WhatsappQuickRepliesService } from './whatsapp-quick-replies.service';
import { WhatsappTasksService } from './whatsapp-tasks.service';
import { WhatsappWebhookService } from './whatsapp-webhook.service';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';
import {
  WhatsappBotController,
  WhatsappOverviewController,
  WhatsappQuickRepliesController,
} from './whatsapp-bot.controller';
import {
  WhatsappAccessController,
  WhatsappConnectionController,
  WhatsappContactsController,
  WhatsappConversationsController,
  WhatsappTemplatesController,
} from './whatsapp.controller';

/**
 * WhatsApp through the official Cloud API: connection, public webhook, contacts,
 * conversations, messages, the bot of the attendance and the bridge with the
 * tasks of the Azuos Env.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Workspace.name, schema: WorkspaceSchema }]),
    WhatsappDataModule,
    SecretsModule,
    StorageModule,
    NotificationsModule,
    HierarchyModule,
    TasksModule,
    WorkspacesModule,
    AiModule,
  ],
  controllers: [
    WhatsappAccessController,
    WhatsappConnectionController,
    WhatsappTemplatesController,
    WhatsappConversationsController,
    WhatsappContactsController,
    WhatsappBotController,
    WhatsappQuickRepliesController,
    WhatsappOverviewController,
    WhatsappWebhookController,
  ],
  providers: [
    MetaGraphProvider,
    MockWhatsappGraphProvider,
    {
      provide: WhatsappGraphProvider,
      inject: [ConfigService, MetaGraphProvider, MockWhatsappGraphProvider],
      // WHATSAPP_MOCK (nunca em produção) troca a Cloud API pela falsa, que é
      // o que o e2e do front usa para receber e responder sem WABA.
      useFactory: (
        config: ConfigService,
        real: MetaGraphProvider,
        mock: MockWhatsappGraphProvider,
      ): WhatsappGraphProvider =>
        config.get<boolean>('WHATSAPP_MOCK') === true &&
        config.get<string>('NODE_ENV') !== 'production'
          ? mock
          : real,
    },
    WhatsappConnectionsService,
    WhatsappContactsService,
    WhatsappConversationsService,
    WhatsappMessagesService,
    WhatsappBotSettingsService,
    WhatsappBotService,
    WhatsappQuickRepliesService,
    WhatsappMetricsService,
    WhatsappTasksService,
    WhatsappWebhookService,
  ],
  exports: [WhatsappWebhookService],
})
export class WhatsappModule {}
