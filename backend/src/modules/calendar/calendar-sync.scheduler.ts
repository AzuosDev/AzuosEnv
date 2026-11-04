import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CalendarSyncService } from './calendar-sync.service';

/** Two-way synchronization of every connected account, every 15 minutes. */
@Injectable()
export class CalendarSyncScheduler {
  private readonly logger = new Logger(CalendarSyncScheduler.name);

  constructor(private readonly sync: CalendarSyncService) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async run(): Promise<void> {
    try {
      await this.sync.syncAll();
    } catch (error) {
      this.logger.error(
        'Falha no ciclo de sincronização do calendário.',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
