import { defineConfig, devices } from '@playwright/test';

const FRONT_PORT = Number(process.env.E2E_FRONT_PORT ?? 5173);
const API_PORT = Number(process.env.E2E_API_PORT ?? 3100);

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['line']],
  use: {
    baseURL: `http://localhost:${FRONT_PORT}`,
    ...devices['Desktop Chrome'],
  },
  webServer: [
    {
      command: 'npm run start:e2e',
      cwd: '../backend',
      url: `http://localhost:${API_PORT}/api/v1/health`,
      reuseExistingServer: !process.env.CI,
      env: {
        E2E_PORT: String(API_PORT),
        CORS_ORIGINS: `http://localhost:${FRONT_PORT},http://localhost:4173`,
        APP_URL: `http://localhost:${FRONT_PORT}`,
      },
      timeout: 240_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: `npm run dev -- --port ${String(FRONT_PORT)} --strictPort`,
      url: `http://localhost:${FRONT_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { VITE_API_URL: `http://localhost:${API_PORT}` },
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});
