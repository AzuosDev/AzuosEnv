import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HierarchyModule } from '../hierarchy/hierarchy.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SecretsModule } from '../secrets/secrets.module';
import { StorageModule } from '../storage/storage.module';
import { TasksModule } from '../tasks/tasks.module';
import { Workspace, WorkspaceSchema } from '../workspaces/schemas/workspace.schema';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { MetaGraphProvider } from './graph/meta-graph.provider';
import { WhatsappGraphProvider } from './graph/whatsapp-graph.provider';
import { WhatsappDataModule } from './whatsapp-data.module';
import { WhatsappConnectionsService } from './whatsapp-connections.service';
import { WhatsappContactsService } from './whatsapp-contacts.service';
import { WhatsappConversationsService } from './whatsapp-conversations.service';
import { WhatsappMessagesService } from './whatsapp-messages.service';
import { WhatsappTasksService } from './whatsapp-tasks.service';
import { WhatsappWebhookService } from './whatsapp-webhook.service';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';
import {
  WhatsappAccessController,
  WhatsappConnectionController,
  WhatsappContactsController,
  WhatsappConversationsController,
  WhatsappTemplatesController,
} from './whatsapp.controller';

/**
 * WhatsApp through the official Cloud API: connection, public webhook, contacts,
 * conversations, messages and the bridge with the tasks of the Azuos Env.
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
  ],
  controllers: [
    WhatsappAccessController,
    WhatsappConnectionController,
    WhatsappTemplatesController,
    WhatsappConversationsController,
    WhatsappContactsController,
    WhatsappWebhookController,
  ],
  providers: [
    { provide: WhatsappGraphProvider, useClass: MetaGraphProvider },
    WhatsappConnectionsService,
    WhatsappContactsService,
    WhatsappConversationsService,
    WhatsappMessagesService,
    WhatsappTasksService,
    WhatsappWebhookService,
  ],
  exports: [WhatsappWebhookService],
})
export class WhatsappModule {}
