import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schemas/base-schema-options';
import { DEPENDENCY_TYPES, DependencyType } from '../collaboration-fields';

@Schema({ collection: 'task_dependencies', ...baseSchemaOptions })
export class TaskDependency {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Task', required: true, index: true })
  taskId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Task', required: true, index: true })
  dependsOnId: Types.ObjectId;

  @Prop({ type: String, enum: DEPENDENCY_TYPES, required: true })
  type: DependencyType;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;
}

export type TaskDependencyDocument = HydratedDocument<TaskDependency>;

export const TaskDependencySchema = SchemaFactory.createForClass(TaskDependency);

TaskDependencySchema.index(
  { workspaceId: 1, taskId: 1, dependsOnId: 1, type: 1 },
  { unique: true },
);
TaskDependencySchema.index({ workspaceId: 1, dependsOnId: 1 });
