import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PurgeService } from './purge.service';
import { TRASH_RETENTION_DAYS } from './trash-fields';

/** Once a day: everything that has been in the trash for over 30 days goes away. */
@Injectable()
export class TrashScheduler {
  private readonly logger = new Logger(TrashScheduler.name);

  constructor(private readonly purge: PurgeService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async run(): Promise<void> {
    try {
      const counts = await this.purge.purgeExpired();
      const total = counts.spaces + counts.folders + counts.lists + counts.tasks;

      if (total > 0) {
        this.logger.log(
          `Lixeira: ${total} itens com mais de ${TRASH_RETENTION_DAYS} dias apagados de vez.`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Falha no expurgo da lixeira',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
