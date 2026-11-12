import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { GoogleCalendarProvider } from '../integrations/google/google-calendar.provider';
import { GoogleModule } from '../integrations/google/google.module';
import { HierarchyModule } from '../hierarchy/hierarchy.module';
import { TasksDataModule } from '../tasks/tasks-data.module';
import { TasksModule } from '../tasks/tasks.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { CALENDAR_PROVIDER, CalendarProvider, StubCalendarProvider } from './calendar-provider';
import { CalendarSyncScheduler } from './calendar-sync.scheduler';
import { CalendarSyncService } from './calendar-sync.service';
import { CalendarEventsController, PlannerController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { PlannerService } from './planner.service';
import { CalendarEvent, CalendarEventSchema } from './schemas/calendar-event.schema';

/**
 * The provider is chosen here, like the AiProvider: with GOOGLE_CLIENT_ID set the
 * Google provider talks to the Calendar API; without it the stub keeps the planner
 * local, which is what the tests use.
 */
function calendarProviderFactory(
  config: ConfigService,
  google: GoogleCalendarProvider,
): CalendarProvider {
  const clientId = (config.get<string>('GOOGLE_CLIENT_ID') ?? '').trim();

  return clientId.length > 0 ? google : new StubCalendarProvider();
}

@Module({
  imports: [
    MongooseModule.forFeature([{ name: CalendarEvent.name, schema: CalendarEventSchema }]),
    TasksDataModule,
    TasksModule,
    HierarchyModule,
    WorkspacesModule,
    GoogleModule,
  ],
  controllers: [CalendarEventsController, PlannerController],
  providers: [
    CalendarService,
    PlannerService,
    CalendarSyncService,
    CalendarSyncScheduler,
    {
      provide: CALENDAR_PROVIDER,
      inject: [ConfigService, GoogleCalendarProvider],
      useFactory: calendarProviderFactory,
    },
  ],
  exports: [MongooseModule, CalendarService, CalendarSyncService],
})
export class CalendarModule {}
