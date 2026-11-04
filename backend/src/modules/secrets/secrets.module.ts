import { Module } from '@nestjs/common';
import { SecretsService } from './secrets.service';

/** Shared by the integrations and by the Google provider of the calendar. */
@Module({
  providers: [SecretsService],
  exports: [SecretsService],
})
export class SecretsModule {}
