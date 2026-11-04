import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import {
  CalendarProvider,
  CalendarSyncRange,
  ExternalCalendarEvent,
} from '../../calendar/calendar-provider';
import { CalendarSource } from '../../calendar/calendar-fields';
import { GOOGLE_CALENDAR_API, GOOGLE_TIMEOUT_MS, MAX_GOOGLE_EVENTS } from './google-fields';
import { GoogleOAuthService } from './google-oauth.service';

interface GoogleDateTime {
  dateTime?: string;
  date?: string;
}

interface GoogleEvent {
  id?: string;
  summary?: string;
  status?: string;
  start?: GoogleDateTime;
  end?: GoogleDateTime;
  hangoutLink?: string;
  recurrence?: string[];
}

/**
 * CalendarProvider of the Etapa 14 talking to the Google Calendar API. The tokens
 * come from the connection of the user, so each member syncs their own agenda.
 */
@Injectable()
export class GoogleCalendarProvider implements CalendarProvider {
  readonly source: CalendarSource = 'google';

  private readonly logger = new Logger(GoogleCalendarProvider.name);

  constructor(
    private readonly oauth: GoogleOAuthService,
    private readonly config: ConfigService,
  ) {}

  async isConnected(workspaceId: Types.ObjectId, userId: Types.ObjectId): Promise<boolean> {
    return (await this.oauth.connectionOf(workspaceId, userId)) !== null;
  }

  async pull(range: CalendarSyncRange): Promise<ExternalCalendarEvent[]> {
    const token = await this.tokenOf(range);

    if (!token) {
      return [];
    }

    const params = new URLSearchParams({
      timeMin: range.from.toISOString(),
      timeMax: range.to.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: String(MAX_GOOGLE_EVENTS),
    });
    const body = await this.request<{ items?: GoogleEvent[] }>(
      token,
      `/calendars/${this.calendarId()}/events?${params.toString()}`,
      { method: 'GET' },
    );

    if (!body) {
      return [];
    }

    return (body.items ?? [])
      .filter((event) => event.status !== 'cancelled')
      .map((event) => this.toExternal(event))
      .filter((event): event is ExternalCalendarEvent => event !== null);
  }

  async push(range: CalendarSyncRange, event: ExternalCalendarEvent): Promise<string | null> {
    const token = await this.tokenOf(range);

    if (!token) {
      return null;
    }

    const path = event.externalId
      ? `/calendars/${this.calendarId()}/events/${encodeURIComponent(event.externalId)}`
      : `/calendars/${this.calendarId()}/events`;
    const body = await this.request<GoogleEvent>(token, path, {
      method: event.externalId ? 'PATCH' : 'POST',
      body: JSON.stringify(this.toGoogle(event)),
    });

    return body?.id ?? null;
  }

  async remove(range: CalendarSyncRange, externalId: string): Promise<void> {
    const token = await this.tokenOf(range);

    if (!token) {
      return;
    }

    await this.request(
      token,
      `/calendars/${this.calendarId()}/events/${encodeURIComponent(externalId)}`,
      { method: 'DELETE' },
    );
  }

  private toExternal(event: GoogleEvent): ExternalCalendarEvent | null {
    const start = this.toDate(event.start);
    const end = this.toDate(event.end);

    if (!event.id || !start || !end) {
      return null;
    }

    return {
      externalId: event.id,
      title: event.summary ?? 'Evento do Google',
      start,
      end,
      allDay: Boolean(event.start?.date),
      meetUrl: event.hangoutLink ?? null,
      recurrence: event.recurrence?.[0] ?? null,
    };
  }

  private toGoogle(event: ExternalCalendarEvent): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      summary: event.title,
      start: event.allDay
        ? { date: event.start.toISOString().slice(0, 10) }
        : { dateTime: event.start.toISOString() },
      end: event.allDay
        ? { date: event.end.toISOString().slice(0, 10) }
        : { dateTime: event.end.toISOString() },
    };

    if (event.recurrence) {
      payload.recurrence = [event.recurrence];
    }

    return payload;
  }

  private toDate(value: GoogleDateTime | undefined): Date | null {
    const raw = value?.dateTime ?? value?.date;

    if (!raw) {
      return null;
    }

    const date = new Date(raw);

    return Number.isNaN(date.getTime()) ? null : date;
  }

  private tokenOf(range: CalendarSyncRange): Promise<string | null> {
    return this.oauth.accessTokenFor(range.workspaceId, range.userId);
  }

  private calendarId(): string {
    return encodeURIComponent(this.config.get<string>('GOOGLE_CALENDAR_ID') ?? 'primary');
  }

  /** null on any failure: a calendar out of reach never breaks the sync cycle. */
  private async request<T>(
    token: string,
    path: string,
    init: { method: string; body?: string },
  ): Promise<T | null> {
    try {
      const response = await fetch(`${GOOGLE_CALENDAR_API}${path}`, {
        method: init.method,
        headers: {
          authorization: `Bearer ${token}`,
          ...(init.body ? { 'content-type': 'application/json' } : {}),
        },
        body: init.body,
        signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
      });

      if (!response.ok) {
        this.logger.warn(`O Google respondeu ${response.status} em ${init.method} ${path}.`);

        return null;
      }

      if (response.status === 204) {
        return null;
      }

      return (await response.json()) as T;
    } catch (error) {
      this.logger.warn(
        `Falha ao falar com o Google: ${error instanceof Error ? error.message : String(error)}`,
      );

      return null;
    }
  }
}
