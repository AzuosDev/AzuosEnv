import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  MAX_PUSHED_EVENTS,
  SYNC_FUTURE_DAYS,
  SYNC_PAST_DAYS,
} from '../integrations/google/google-fields';
import { GoogleOAuthService } from '../integrations/google/google-oauth.service';
import {
  CALENDAR_PROVIDER,
  CalendarProvider,
  CalendarSyncRange,
  ExternalCalendarEvent,
} from './calendar-provider';
import { CalendarEvent, CalendarEventDocument } from './schemas/calendar-event.schema';

export interface SyncResult {
  pulled: number;
  pushed: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Two-way synchronization with the external calendar. Events of the provider land
 * as `source: google` rows and local events are pushed once, keeping the id the
 * provider gave them, so nothing is duplicated on the next cycle.
 */
@Injectable()
export class CalendarSyncService {
  private readonly logger = new Logger(CalendarSyncService.name);

  constructor(
    @InjectModel(CalendarEvent.name) private readonly events: Model<CalendarEvent>,
    @Inject(CALENDAR_PROVIDER) private readonly provider: CalendarProvider,
    private readonly google: GoogleOAuthService,
  ) {}

  /** Every connected account; public so the e2e runs it without the cron. */
  async syncAll(now: Date = new Date()): Promise<SyncResult> {
    const total: SyncResult = { pulled: 0, pushed: 0 };

    for (const connection of await this.google.activeConnections()) {
      try {
        const result = await this.syncOne(connection.workspaceId, connection.userId, now);

        total.pulled += result.pulled;
        total.pushed += result.pushed;
        await this.google.markSynced(connection._id);
      } catch (error) {
        this.logger.warn(
          `Falha ao sincronizar o calendário de ${String(connection.userId)}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return total;
  }

  async syncOne(
    workspaceId: Types.ObjectId,
    userId: Types.ObjectId,
    now: Date = new Date(),
  ): Promise<SyncResult> {
    const range: CalendarSyncRange = {
      workspaceId,
      userId,
      from: new Date(now.getTime() - SYNC_PAST_DAYS * DAY_MS),
      to: new Date(now.getTime() + SYNC_FUTURE_DAYS * DAY_MS),
    };

    if (!(await this.provider.isConnected(workspaceId, userId))) {
      return { pulled: 0, pushed: 0 };
    }

    return {
      pulled: await this.pull(range),
      pushed: await this.push(range),
    };
  }

  /** External events become local rows with `source: google`. */
  private async pull(range: CalendarSyncRange): Promise<number> {
    const external = await this.provider.pull(range);

    for (const event of external) {
      await this.events
        .updateOne(
          {
            workspaceId: range.workspaceId,
            userId: range.userId,
            source: this.provider.source,
            externalId: event.externalId,
          },
          {
            $set: {
              title: event.title,
              start: event.start,
              end: event.end,
              allDay: event.allDay,
              meetUrl: event.meetUrl,
              recurrence: event.recurrence,
            },
            $setOnInsert: { attendeeIds: [], taskId: null },
          },
          { upsert: true },
        )
        .exec();
    }

    return external.length;
  }

  /** Local events the provider has never seen are created there. */
  private async push(range: CalendarSyncRange): Promise<number> {
    const pending = await this.events
      .find({
        workspaceId: range.workspaceId,
        userId: range.userId,
        source: 'local',
        externalId: null,
        start: { $gte: range.from, $lte: range.to },
      })
      .sort({ start: 1 })
      .limit(MAX_PUSHED_EVENTS)
      .exec();
    let pushed = 0;

    for (const event of pending) {
      const externalId = await this.provider.push(range, this.toExternal(event));

      if (!externalId) {
        continue;
      }

      await this.events.updateOne({ _id: event._id }, { $set: { externalId } }).exec();
      pushed += 1;
    }

    return pushed;
  }

  private toExternal(event: CalendarEventDocument): ExternalCalendarEvent {
    return {
      externalId: event.externalId ?? '',
      title: event.title,
      start: event.start,
      end: event.end,
      allDay: event.allDay,
      meetUrl: event.meetUrl ?? null,
      recurrence: event.recurrence ?? null,
    };
  }
}
