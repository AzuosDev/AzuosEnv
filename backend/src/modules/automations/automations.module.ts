import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CollaborationModule } from '../collaboration/collaboration.module';
import { CollaborationDataModule } from '../collaboration/collaboration-data.module';
import { FieldsModule } from '../fields/fields.module';
import { HierarchyModule } from '../hierarchy/hierarchy.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TasksDataModule } from '../tasks/tasks-data.module';
import { TasksModule } from '../tasks/tasks.module';
import { ViewsModule } from '../views/views.module';
import { Workspace, WorkspaceSchema } from '../workspaces/schemas/workspace.schema';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { AutomationActionsService } from './automation-actions.service';
import { AutomationEngineService } from './automation-engine.service';
import { AutomationHooksController } from './automation-hooks.controller';
import { AutomationRunsService } from './automation-runs.service';
import { AutomationsController } from './automations.controller';
import { AutomationsListener } from './automations.listener';
import { AutomationsScheduler } from './automations.scheduler';
import { AutomationsService } from './automations.service';
import { AutomationRun, AutomationRunSchema } from './schemas/automation-run.schema';
import { Automation, AutomationSchema } from './schemas/automation.schema';
import { Template, TemplateSchema } from './schemas/template.schema';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Automation.name, schema: AutomationSchema },
      { name: AutomationRun.name, schema: AutomationRunSchema },
      { name: Template.name, schema: TemplateSchema },
      { name: Workspace.name, schema: WorkspaceSchema },
    ]),
    TasksModule,
    TasksDataModule,
    CollaborationModule,
    CollaborationDataModule,
    HierarchyModule,
    ViewsModule,
    FieldsModule,
    NotificationsModule,
    WorkspacesModule,
  ],
  controllers: [AutomationsController, TemplatesController, AutomationHooksController],
  providers: [
    AutomationsService,
    AutomationRunsService,
    AutomationActionsService,
    AutomationEngineService,
    AutomationsListener,
    AutomationsScheduler,
    TemplatesService,
  ],
  exports: [AutomationsService, AutomationsScheduler, AutomationEngineService, TemplatesService],
})
export class AutomationsModule {}
