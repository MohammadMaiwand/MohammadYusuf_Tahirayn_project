import { defineConfig } from '@playwright/test';
import base from './playwright.config';
process.env.MYT_AUTH_E2E = 'true';
const database = process.env.MYT_UI_DATABASE!;
export default defineConfig({
  ...base,
  testMatch: 'auth.spec.ts',
  outputDir: '.local/auth-e2e-results',
  reporter: [
    ['list'],
    ['html', { outputFolder: '.local/auth-e2e-report', open: 'never' }],
  ],
  webServer: [
    {
      command: 'npm start -w backend',
      url: 'http://127.0.0.1:4000/api/v1/ready',
      reuseExistingServer: false,
      timeout: 60000,
      env: {
        NODE_ENV: 'development',
        HOST: '127.0.0.1',
        PORT: '4000',
        DEV_IDENTITY_ENABLED: 'false',
        OFFLINE_SYNC_ENABLED: 'true',
        LOG_LEVEL: 'silent',
        RATE_LIMIT_MAX: '5000',
        JWT_SECRET: 'browser-test-secret-only-not-real-credentials-123',
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
