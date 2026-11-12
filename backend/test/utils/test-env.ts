import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Uploads of the e2e suite; the global teardown removes the folder. */
export const TEST_UPLOAD_DIR = join(tmpdir(), 'azuos-env-test-uploads');

/** Environment used by the e2e suite. MONGODB_URI is set by the global setup. */
export const TEST_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  PORT: '0',
  CORS_ORIGINS: 'http://localhost:5173',
  JWT_ACCESS_SECRET: 'test-access-secret-value',
  JWT_REFRESH_SECRET: 'test-refresh-secret-value',
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL: '30d',
  COOKIE_SECURE: 'false',
  COOKIE_DOMAIN: '',
  UPLOAD_DIR: TEST_UPLOAD_DIR,
  // Empty host keeps the suite on LogMailService; otherwise the .env credentials
  // make every run send real mail and burn the provider's daily quota.
  SMTP_HOST: '',
  // No client id: the CalendarProvider of the suite is always the stub.
  GOOGLE_CLIENT_ID: '',
  // Login with Google against the fake provider, never the real Google.
  GOOGLE_MOCK: 'true',
  GOOGLE_LOGIN_REDIRECT_URI: 'http://localhost:3000/api/v1/auth/google/callback',
  FRONTEND_URL: 'http://localhost:5173',
  // No key: the AiProvider of the suite is always the stub.
  XAI_API_KEY: '',
  GROK_MODEL: 'grok-test',
  AI_MONTHLY_TOKEN_BUDGET: '100000',
};

export const TEST_DB_NAME = 'azuos-env-test';
