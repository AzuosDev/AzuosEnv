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
};

export const TEST_DB_NAME = 'azuos-env-test';
