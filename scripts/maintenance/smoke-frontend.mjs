import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '../..');
const reservation = createServer();
await new Promise((accept, reject) => {
  reservation.once('error', reject);
  reservation.listen(0, '127.0.0.1', accept);
});
const { port } = reservation.address();
await new Promise((accept) => reservation.close(accept));
const child = spawn(
  process.execPath,
  [
    resolve(root, 'node_modules/vite/bin/vite.js'),
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '--strictPort',
  ],
  { cwd: resolve(root, 'frontend'), stdio: 'ignore', windowsHide: true },
);
try {
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    if (child.exitCode !== null)
      throw new Error('Preview server exited before readiness');
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      if (
        response.ok &&
        (await response.text()).includes('MYT Trading Company')
      ) {
        ready = true;
        break;
      }
    } catch {
      /* Wait for the preview listener. */
    }
    await new Promise((accept) => setTimeout(accept, 100));
  }
  assert(ready, 'Preview did not become ready');
  for (const asset of [
    '/sw.js',
    '/manifest.webmanifest',
    '/icons/app-192.png',
    '/icons/app-512.png',
  ]) {
    const response = await fetch(`http://127.0.0.1:${port}${asset}`);
    assert.equal(response.status, 200, asset);
  }
  console.log(
    'PASS: production preview serves the application, service worker, manifest and both icons over HTTP.',
  );
} finally {
  child.kill();
}
