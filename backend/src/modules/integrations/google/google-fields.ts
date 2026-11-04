export const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
export const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
export const GOOGLE_USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo';

/** Read and write on the calendar of the user; nothing else is requested. */
export const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';

export const GOOGLE_TIMEOUT_MS = 15_000;

/** Window refreshed before the access token is considered expired. */
export const TOKEN_REFRESH_SKEW_MS = 60_000;

/** Events read from Google per synchronization. */
export const MAX_GOOGLE_EVENTS = 250;

/** Local events pushed to Google per synchronization. */
export const MAX_PUSHED_EVENTS = 100;

/** Days before and after now the synchronization covers. */
export const SYNC_PAST_DAYS = 7;
export const SYNC_FUTURE_DAYS = 30;
