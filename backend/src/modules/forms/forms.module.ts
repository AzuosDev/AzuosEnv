import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AutomationsModule } from '../automations/automations.module';
import { HierarchyModule } from '../hierarchy/hierarchy.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TasksModule } from '../tasks/tasks.module';
import { Workspace, WorkspaceSchema } from '../workspaces/schemas/workspace.schema';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { FormSubmissionsService } from './form-submissions.service';
import { FormsController } from './forms.controller';
import { FormsService } from './forms.service';
import { PublicFormsController } from './public-forms.controller';
import { Form, FormSchema } from './schemas/form.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Form.name, schema: FormSchema },
      { name: Workspace.name, schema: WorkspaceSchema },
    ]),
    HierarchyModule,
    TasksModule,
    NotificationsModule,
    AutomationsModule,
    WorkspacesModule,
  ],
  controllers: [FormsController, PublicFormsController],
  providers: [FormsService, FormSubmissionsService],
  exports: [FormsService],
})
export class FormsModule {}
