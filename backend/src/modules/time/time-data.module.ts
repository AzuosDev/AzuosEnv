import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TimeEntry, TimeEntrySchema } from './schemas/time-entry.schema';

/**
 * Collection of the time module. Separate from TimeModule so the purge can drop
 * the entries of a task without a circular dependency.
 */
@Module({
  imports: [MongooseModule.forFeature([{ name: TimeEntry.name, schema: TimeEntrySchema }])],
  exports: [MongooseModule],
})
export class TimeDataModule {}
