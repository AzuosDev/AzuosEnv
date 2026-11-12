import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatDataModule } from '../chat/chat-data.module';
import { ChatModule } from '../chat/chat.module';
import { CollaborationModule } from '../collaboration/collaboration.module';
import { DocsDataModule } from '../docs/docs-data.module';
import { HierarchyModule } from '../hierarchy/hierarchy.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TasksModule } from '../tasks/tasks.module';
import { Workspace, WorkspaceSchema } from '../workspaces/schemas/workspace.schema';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { AiAgentRunnerService } from './ai-agent-runner.service';
import { AiAgentsScheduler } from './ai-agents.scheduler';
import { AiAgentsService } from './ai-agents.service';
import { AiAssistService } from './ai-assist.service';
import { AiChatService } from './ai-chat.service';
import { AI_PROVIDER, AiProvider } from './ai-provider';
import { AiToolsService } from './ai-tools.service';
import { AiUsageService } from './ai-usage.service';
import { AiAgentsController, AiController } from './ai.controller';
import { GrokProvider } from './grok.provider';
import { AiAgent, AiAgentSchema } from './schemas/ai-agent.schema';
import { AiConversation, AiConversationSchema } from './schemas/ai-conversation.schema';
import { AiUsageEntry, AiUsageEntrySchema } from './schemas/ai-usage.schema';
import { StubAiProvider } from './stub-ai.provider';

/**
 * The provider is chosen here, like the MailService: with XAI_API_KEY set the Grok
 * provider talks to the API of xAI; without it the stub answers locally, which is
 * what the tests always use.
 */
function aiProviderFactory(config: ConfigService): AiProvider {
  const apiKey = (config.get<string>('XAI_API_KEY') ?? '').trim();
  const model = (config.get<string>('GROK_MODEL') ?? '').trim();

  if (apiKey.length === 0) {
    return new StubAiProvider(model.length > 0 ? model : 'stub');
  }

  return new GrokProvider({
    apiKey,
    baseUrl: config.getOrThrow<string>('XAI_BASE_URL'),
    model,
  });
}

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AiConversation.name, schema: AiConversationSchema },
      { name: AiUsageEntry.name, schema: AiUsageEntrySchema },
      { name: AiAgent.name, schema: AiAgentSchema },
      { name: Workspace.name, schema: WorkspaceSchema },
    ]),
    TasksModule,
    HierarchyModule,
    CollaborationModule,
    ChatModule,
    ChatDataModule,
    DocsDataModule,
    NotificationsModule,
    WorkspacesModule,
  ],
  controllers: [AiController, AiAgentsController],
  providers: [
    { provide: AI_PROVIDER, inject: [ConfigService], useFactory: aiProviderFactory },
    AiUsageService,
    AiToolsService,
    AiChatService,
    AiAssistService,
    AiAgentsService,
    AiAgentRunnerService,
    AiAgentsScheduler,
  ],
  exports: [AI_PROVIDER, AiAgentsService, AiAgentRunnerService],
})
export class AiModule {}
