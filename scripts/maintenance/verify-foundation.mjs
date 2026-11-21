import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '../..');
const required = [
  'frontend/public/icons',
  'frontend/public/images',
  'frontend/src/app',
  'frontend/src/assets',
  'frontend/src/hooks',
  'frontend/src/i18n',
  'frontend/src/offline',
  'frontend/src/router',
  'backend/src/config',
  'backend/src/database',
  'backend/src/middleware',
  'backend/src/security',
  'backend/src/services',
  'backend/src/utils',
  'backend/src/validators',
  'backend/src/types',
  'backend/src/jobs',
  'backend/src/routes',
  'shared/types',
  'shared/constants',
  'shared/schemas',
  'shared/utils',
  'docs',
  'Launcher/scripts',
  'scripts/install',
  'scripts/development',
  'scripts/database',
  'scripts/maintenance',
];
for (const folder of required)
  assert(existsSync(join(root, folder)), `Missing ${folder}`);
for (const name of [
  'SYSTEM_MASTER_DOCUMENT',
  'PROJECT_STATUS',
  'SYSTEM_ARCHITECTURE',
  'DATABASE_SCHEMA',
  'API_DOCUMENTATION',
  'FOLDER_STRUCTURE',
  'INSTALLATION_GUIDE',
  'SECURITY_DOCUMENTATION',
  'OFFLINE_SYNC_DOCUMENTATION',
  'PRINTING_DOCUMENTATION',
  'PERMISSIONS_DOCUMENTATION',
  'CHANGELOG',
  'DEVELOPMENT_ROADMAP',
  'DECISIONS_LOG',
  'TASK_TRACKER',
])
  assert(existsSync(join(root, `docs/${name}.md`)), `Missing ${name}`);
for (const workspace of ['', 'frontend', 'backend', 'shared']) {
  const pkg = JSON.parse(
    readFileSync(join(root, workspace, 'package.json'), 'utf8'),
  );
  assert(pkg.private, `${workspace} must be private`);
  JSON.parse(
    readFileSync(
      join(
        root,
        workspace || '.',
        workspace ? 'tsconfig.json' : 'tsconfig.base.json',
      ),
      'utf8',
    ),
  );
}
const manifest = JSON.parse(
  readFileSync(join(root, 'frontend/public/manifest.webmanifest'), 'utf8'),
);
for (const icon of manifest.icons) {
  const png = readFileSync(join(root, 'frontend/public', icon.src));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), Number(icon.sizes.split('x')[0]));
}
assert(
  !readdirSync(join(root, 'backend/src/modules')).includes('sham-shaban'),
  'Sham Shaban must not have an operational module',
);
console.log(
  'Verified required structure, package/TS JSON, manifest icons and disabled-branch module boundary.',
);
