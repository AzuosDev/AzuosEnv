import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CountersService } from './counters.service';
import { Counter, CounterSchema } from './schemas/counter.schema';
import { Tag, TagSchema } from './schemas/tag.schema';
import { Task, TaskSchema } from './schemas/task.schema';
import { TaskCountsService } from './task-counts.service';

/**
 * Collections of the tasks module. Separate from TasksModule so the hierarchy can
 * read task counts without a circular dependency.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Task.name, schema: TaskSchema },
      { name: Tag.name, schema: TagSchema },
      { name: Counter.name, schema: CounterSchema },
    ]),
  ],
  providers: [TaskCountsService, CountersService],
  exports: [MongooseModule, TaskCountsService, CountersService],
})
export class TasksDataModule {}
