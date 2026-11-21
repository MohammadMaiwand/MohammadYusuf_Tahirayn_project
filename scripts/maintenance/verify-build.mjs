import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
for (const artifact of [
  'shared/dist/index.js',
  'shared/dist/index.d.ts',
  'backend/dist/server.js',
  'backend/dist/app.js',
  'frontend/dist/index.html',
  'frontend/dist/sw.js',
  'frontend/dist/manifest.webmanifest',
]) {
  assert(
    existsSync(join(root, artifact)),
    `Missing build artifact: ${artifact}`,
  );
}
const dist = join(root, 'frontend/dist');
assert(
  readdirSync(dist).some((name) => /^workbox-.*\.js$/.test(name)),
  'Missing generated Workbox runtime',
);
const html = readFileSync(join(dist, 'index.html'), 'utf8');
assert(html.includes('rel="manifest"'), 'Manifest is not linked');
const manifest = JSON.parse(
  readFileSync(join(dist, 'manifest.webmanifest'), 'utf8'),
);
for (const icon of manifest.icons)
  assert(existsSync(join(dist, icon.src)), `Missing built icon ${icon.src}`);
console.log(
  'Verified compiled shared/backend outputs and frontend PWA build artifacts. Browser offline acceptance remains a separate check.',
);
