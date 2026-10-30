import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HierarchyModule } from '../hierarchy/hierarchy.module';
import { TasksDataModule } from '../tasks/tasks-data.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { CustomFieldsController } from './custom-fields.controller';
import { CustomFieldsService } from './custom-fields.service';
import { CustomField, CustomFieldSchema } from './schemas/custom-field.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: CustomField.name, schema: CustomFieldSchema }]),
    HierarchyModule,
    TasksDataModule,
    WorkspacesModule,
  ],
  controllers: [CustomFieldsController],
  providers: [CustomFieldsService],
  exports: [MongooseModule, CustomFieldsService],
})
export class FieldsModule {}
