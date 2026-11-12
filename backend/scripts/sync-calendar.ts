/**
 * Dispara a sincronização do calendário na hora, sem esperar o cron de 10 em 10
 * minutos. Uso: npx ts-node -T scripts/sync-calendar.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { CalendarSyncService } from '../src/modules/calendar/calendar-sync.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const result = await app.get(CalendarSyncService).syncAll();

    console.log(`puxados: ${String(result.pulled)} | enviados: ${String(result.pushed)}`);
  } finally {
    await app.close();
  }
}

void main();
