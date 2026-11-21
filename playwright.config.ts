import { defineConfig } from '@playwright/test';
import { randomUUID } from 'node:crypto';
const database =
  process.env.MYT_UI_DATABASE ||
  `myt_ui_test_${randomUUID().replaceAll('-', '')}`;
process.env.MYT_UI_DATABASE = database;
export default defineConfig({
  testDir: './frontend/e2e',
  testMatch: ['operations.spec.ts', 'alterations.spec.ts'],
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  outputDir: '.local/e2e-results',
  reporter: [
    ['list'],
    ['html', { outputFolder: '.local/e2e-report', open: 'never' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    ...(process.platform === 'win32' ? { channel: 'msedge' } : {}),
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  globalTeardown: './frontend/e2e/cleanup.ts',
  globalSetup: './frontend/e2e/setup.ts',
  webServer: [
    {
      command: 'npm start -w backend',
      url: 'http://127.0.0.1:4000/api/v1/ready',
      reuseExistingServer: false,
      timeout: 60000,
      env: {
        RATE_LIMIT_MAX: '2000',
        NODE_ENV: 'development',
        HOST: '127.0.0.1',
        PORT: '4000',
        DEV_IDENTITY_ENABLED: 'true',
        DEV_ROLE: 'admin',
        OFFLINE_SYNC_ENABLED: 'true',
        LOG_LEVEL: 'silent',
        MONGODB_URI: `mongodb://127.0.0.1:27018/${database}?replicaSet=myt-dev`,
        CORS_ORIGINS: 'http://127.0.0.1:4173,http://localhost:4173',
      },
    },
    {
      command: 'npm run preview -w frontend -- --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: false,
      timeout: 30000,
    },
  ],
});
