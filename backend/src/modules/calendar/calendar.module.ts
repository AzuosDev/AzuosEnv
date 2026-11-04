import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HierarchyModule } from '../hierarchy/hierarchy.module';
import { TasksDataModule } from '../tasks/tasks-data.module';
import { TasksModule } from '../tasks/tasks.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { CALENDAR_PROVIDER, StubCalendarProvider } from './calendar-provider';
import { CalendarEventsController, PlannerController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { PlannerService } from './planner.service';
import { CalendarEvent, CalendarEventSchema } from './schemas/calendar-event.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: CalendarEvent.name, schema: CalendarEventSchema }]),
    TasksDataModule,
    TasksModule,
    HierarchyModule,
    WorkspacesModule,
  ],
  controllers: [CalendarEventsController, PlannerController],
  providers: [
    CalendarService,
    PlannerService,
    { provide: CALENDAR_PROVIDER, useClass: StubCalendarProvider },
  ],
  exports: [MongooseModule, CalendarService],
})
export class CalendarModule {}
