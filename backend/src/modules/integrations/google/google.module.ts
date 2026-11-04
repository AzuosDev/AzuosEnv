import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SecretsModule } from '../../secrets/secrets.module';
import { WorkspacesModule } from '../../workspaces/workspaces.module';
import { GoogleCalendarProvider } from './google-calendar.provider';
import { GoogleOAuthService } from './google-oauth.service';
import { GoogleCallbackController, GoogleIntegrationController } from './google.controller';
import { CalendarConnection, CalendarConnectionSchema } from './schemas/calendar-connection.schema';

/**
 * OAuth2 and the calendar provider of Google. It knows nothing about the local
 * calendar, so CalendarModule can import it and bind CALENDAR_PROVIDER without a
 * circular dependency.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CalendarConnection.name, schema: CalendarConnectionSchema },
    ]),
    SecretsModule,
    WorkspacesModule,
  ],
  controllers: [GoogleIntegrationController, GoogleCallbackController],
  providers: [GoogleOAuthService, GoogleCalendarProvider],
  exports: [GoogleOAuthService, GoogleCalendarProvider],
})
export class GoogleModule {}
