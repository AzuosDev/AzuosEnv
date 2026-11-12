import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { CalendarSource } from './calendar-fields';

/** Event as an external calendar hands it over, before it becomes a local row. */
export interface ExternalCalendarEvent {
  externalId: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  meetUrl: string | null;
  recurrence: string | null;
}

export interface CalendarSyncRange {
  workspaceId: Types.ObjectId;
  userId: Types.ObjectId;
  from: Date;
  to: Date;
}

/**
 * Contract of a two-way calendar integration. Only the stub exists in this Etapa;
 * the Google provider lands in the Etapa 16 and replaces the binding of the token.
 */
export interface CalendarProvider {
  readonly source: CalendarSource;
  /** True once the user has connected the account of the provider. */
  isConnected(workspaceId: Types.ObjectId, userId: Types.ObjectId): Promise<boolean>;
  pull(range: CalendarSyncRange): Promise<ExternalCalendarEvent[]>;
  push(range: CalendarSyncRange, event: ExternalCalendarEvent): Promise<string | null>;
  remove(range: CalendarSyncRange, externalId: string): Promise<void>;
}

export const CALENDAR_PROVIDER = Symbol('CALENDAR_PROVIDER');

/** Nobody is connected yet, so every call is a no-op and the planner stays local. */
@Injectable()
export class StubCalendarProvider implements CalendarProvider {
  readonly source: CalendarSource = 'google';

  isConnected(): Promise<boolean> {
    return Promise.resolve(false);
  }

  pull(): Promise<ExternalCalendarEvent[]> {
    return Promise.resolve([]);
  }

  push(): Promise<string | null> {
    return Promise.resolve(null);
  }

  remove(): Promise<void> {
    return Promise.resolve();
  }
}
