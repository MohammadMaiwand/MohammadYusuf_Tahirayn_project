import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const read = (name) => readFileSync(join(root, name), 'utf8');
const write = (name, text) => writeFileSync(join(root, name), text);
const lock = JSON.parse(read('package-lock.json'));
const rows = [];
for (const workspace of ['', 'shared', 'backend', 'frontend']) {
  const pkg = JSON.parse(read(join(workspace, 'package.json')));
  for (const kind of ['dependencies', 'devDependencies']) {
    for (const [name, range] of Object.entries(pkg[kind] || {})) {
      const candidate =
        lock.packages[
          `${workspace ? workspace + '/' : ''}node_modules/${name}`
        ] ||
        lock.packages[`node_modules/${name}`] ||
        lock.packages[name === '@myt/shared' ? 'shared' : '__missing__'];
      const entry = candidate?.link
        ? lock.packages[candidate.resolved]
        : candidate;
      rows.push(
        `| ${workspace || 'root'} | ${name} | ${range} | ${entry?.version || 'unresolved'} | ${kind} |`,
      );
    }
  }
}
write(
  'docs/DEPENDENCIES.md',
  '# Dependency inventory\n\nGenerated from workspace manifests and package-lock.json. The lockfile pins the complete transitive dependency graph. Runtime libraries support the implementation described in SYSTEM_MASTER.md, including Argon2id password hashing for implemented cookie-session authentication and authorized account management.\n\n| Workspace | Package | Requested | Locked version | Kind |\n|---|---|---|---|---|\n' +
    rows.join('\n') +
    '\n',
);

const ignored = new Set([
  'node_modules',
  '.npm-cache',
  '.git',
  'dist',
  'dev-dist',
  '.runtime',
  '.local',
  'Acount',
  '__pycache__',
  '.tmp_jsdom',
  'work',
  'logs',
  'exports',
]);
const lines = [];
function tree(directory, depth = 0) {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort(
    (a, b) =>
      Number(b.isDirectory()) - Number(a.isDirectory()) ||
      a.name.localeCompare(b.name),
  )) {
    if (
      ignored.has(entry.name) ||
      entry.name.endsWith('.log') ||
      entry.name === 'build_log.txt' ||
      (entry.name.startsWith('.env') && entry.name !== '.env.example')
    )
      continue;
    lines.push(
      '  '.repeat(depth) + entry.name + (entry.isDirectory() ? '/' : ''),
    );
    if (entry.isDirectory()) tree(join(directory, entry.name), depth + 1);
  }
}
tree(root);
const prior = read('docs/FOLDER_STRUCTURE.md');
const narrative = prior.slice(prior.indexOf('Frontend public/icons'));
write(
  'docs/FOLDER_STRUCTURE.md',
  '# Folder structure\n\nThe current workspace is the project root. Dependencies, artifacts, runtime files and local secrets are omitted. This is the complete tracked-source candidate inventory.\n\n```text\n' +
    lines.join('\n') +
    '\n```\n\n' +
    narrative,
);
write(
  'docs/SYSTEM_MASTER_DOCUMENT.md',
  read('SYSTEM_MASTER.md')
    .replaceAll('(docs/', '(')
    .replaceAll('(Launcher/', '(../Launcher/'),
);
console.log(
  'Updated dependency inventory, source tree and technical master mirror.',
);
