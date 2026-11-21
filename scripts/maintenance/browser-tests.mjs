import { spawnSync } from 'node:child_process';
const auth = process.argv.includes('--auth');
// Browser fixtures must never inherit a production/tunnel API URL or disabled
// sync setting from a local Vite mode file.
const env = {
  ...process.env,
  VITE_API_URL: 'http://127.0.0.1:4000/api/v1',
  VITE_OFFLINE_SYNC_ENABLED: 'true',
  ...(!auth ? { VITE_AUTH_PUBLIC_KEY: '' } : {}),
};
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
for (const args of [
  ['run', 'build'],
  [
    'exec',
    '--',
    'playwright',
    'test',
    ...(auth ? ['--config', 'playwright.auth.config.ts'] : []),
  ],
]) {
  const result = spawnSync(npm, args, {
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
