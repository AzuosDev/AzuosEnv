import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CollaborationModule } from '../collaboration/collaboration.module';
import { HierarchyModule } from '../hierarchy/hierarchy.module';
import { SecretsModule } from '../secrets/secrets.module';
import { TasksDataModule } from '../tasks/tasks-data.module';
import { TasksModule } from '../tasks/tasks.module';
import { Workspace, WorkspaceSchema } from '../workspaces/schemas/workspace.schema';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { GithubIntegrationsController, GithubWebhookController } from './github/github.controller';
import { GithubService } from './github/github.service';
import {
  GithubIntegration,
  GithubIntegrationSchema,
} from './github/schemas/github-integration.schema';
import { OutgoingWebhooksController } from './webhooks/outgoing-webhooks.controller';
import { OutgoingWebhooksListener } from './webhooks/outgoing-webhooks.listener';
import { OutgoingWebhooksService } from './webhooks/outgoing-webhooks.service';
import { WebhookDeliveryService } from './webhooks/webhook-delivery.service';
import { WebhooksScheduler } from './webhooks/webhooks.scheduler';
import { OutgoingWebhook, OutgoingWebhookSchema } from './webhooks/schemas/outgoing-webhook.schema';
import { WebhookDelivery, WebhookDeliverySchema } from './webhooks/schemas/webhook-delivery.schema';

/**
 * GitHub (repository -> workspace) and the outgoing webhooks. The Google Agenda
 * lives in its own module, imported by the calendar.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GithubIntegration.name, schema: GithubIntegrationSchema },
      { name: OutgoingWebhook.name, schema: OutgoingWebhookSchema },
      { name: WebhookDelivery.name, schema: WebhookDeliverySchema },
      { name: Workspace.name, schema: WorkspaceSchema },
    ]),
    SecretsModule,
    TasksModule,
    TasksDataModule,
    CollaborationModule,
    HierarchyModule,
    WorkspacesModule,
  ],
  controllers: [GithubIntegrationsController, GithubWebhookController, OutgoingWebhooksController],
  providers: [
    GithubService,
    OutgoingWebhooksService,
    WebhookDeliveryService,
    WebhooksScheduler,
    OutgoingWebhooksListener,
  ],
  exports: [GithubService, OutgoingWebhooksService, WebhookDeliveryService],
})
export class IntegrationsModule {}
