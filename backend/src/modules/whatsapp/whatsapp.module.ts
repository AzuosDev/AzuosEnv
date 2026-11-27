import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiModule } from '../ai/ai.module';
import { HierarchyModule } from '../hierarchy/hierarchy.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SecretsModule } from '../secrets/secrets.module';
import { StorageModule } from '../storage/storage.module';
import { TasksModule } from '../tasks/tasks.module';
import { Workspace, WorkspaceSchema } from '../workspaces/schemas/workspace.schema';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { CloudApiProvider } from './providers/cloud-api.provider';
import { EvolutionProvider } from './providers/evolution.provider';
import { MockWhatsappProvider } from './providers/mock-whatsapp.provider';
import { WhatsappProviders } from './providers/whatsapp-providers.service';
import { WhatsappDataModule } from './whatsapp-data.module';
import { WhatsappBotSettingsService } from './whatsapp-bot-settings.service';
import { WhatsappBotService } from './whatsapp-bot.service';
import { WhatsappConnectionMonitor } from './whatsapp-connection.monitor';
import { WhatsappConnectionsService } from './whatsapp-connections.service';
import { WhatsappContactsService } from './whatsapp-contacts.service';
import { WhatsappConversationsService } from './whatsapp-conversations.service';
import { WhatsappMessagesService } from './whatsapp-messages.service';
import { WhatsappMetricsService } from './whatsapp-metrics.service';
import { WhatsappQuickRepliesService } from './whatsapp-quick-replies.service';
import { WhatsappTasksService } from './whatsapp-tasks.service';
import { WhatsappWebhookService } from './whatsapp-webhook.service';
import {
  WhatsappEvolutionWebhookController,
  WhatsappWebhookController,
} from './whatsapp-webhook.controller';
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
 * WhatsApp of the workspace: connection (Evolution por QR Code, Cloud API
 * mantida), webhook público de cada provedor, contatos, conversas, mensagens, o
 * bot do atendimento e a ponte com as tarefas do Azuos Env.
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
    WhatsappEvolutionWebhookController,
  ],
  providers: [
    EvolutionProvider,
    CloudApiProvider,
    MockWhatsappProvider,
    WhatsappProviders,
    WhatsappConnectionsService,
    WhatsappConnectionMonitor,
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
