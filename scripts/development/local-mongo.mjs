import { spawn } from 'node:child_process';
import {
  mkdirSync,
  openSync,
  closeSync,
  existsSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import mongoose from 'mongoose';

const root = resolve(import.meta.dirname, '../..');
const directory = resolve(root, '.local/mongodb');
const data = resolve(directory, 'data');
const port = 27018;
const uri = `mongodb://127.0.0.1:${port}/admin?directConnection=true`;
const portable = resolve(
  root,
  '.local/tools/mongodb-8.0.38/mongodb-win32-x86_64-windows-8.0.38/bin/mongod.exe',
);
const binary =
  process.env.MYT_MONGOD_PATH ||
  (existsSync(portable)
    ? portable
    : 'C:/Program Files/MongoDB/Server/8.3/bin/mongod.exe');
mkdirSync(data, { recursive: true });
async function client() {
  const connection = new mongoose.mongo.MongoClient(uri, {
    serverSelectionTimeoutMS: 1000,
  });
  try {
    await connection.connect();
    return connection;
  } catch (error) {
    await connection.close();
    throw error;
  }
}
let connection;
try {
  connection = await client();
} catch {
  /* Start only the explicitly isolated development database. */
}
if (process.argv[2] === 'stop') {
  if (connection) {
    const options = await connection
      .db()
      .admin()
      .command({ getCmdLineOpts: 1 });
    if (
      resolve(options.parsed.storage.dbPath) !== data ||
      (options.parsed.replication?.replSetName ||
        options.parsed.replication?.replSet) !== 'myt-dev'
    )
      throw new Error('Refusing to stop an unrecognized MongoDB instance');
    try {
      await connection.db().admin().command({ shutdown: 1 });
    } catch {
      /* A clean shutdown closes the connection. */
    }
    await connection.close();
  }
  console.log('Isolated development MongoDB stopped; data preserved.');
  process.exit(0);
}
if (!connection) {
  if (!existsSync(binary))
    throw new Error(
      'MongoDB binary missing. Set MYT_MONGOD_PATH to an installed mongod binary.',
    );
  const out = openSync(resolve(directory, 'process.log'), 'a');
  const child = spawn(
    binary,
    [
      '--dbpath',
      data,
      '--port',
      String(port),
      '--bind_ip',
      '127.0.0.1',
      '--replSet',
      'myt-dev',
      '--oplogSize',
      '128',
      '--wiredTigerCacheSizeGB',
      '0.25',
      '--logpath',
      resolve(directory, 'mongodb.log'),
      '--logappend',
    ],
    { detached: true, windowsHide: true, stdio: ['ignore', out, out] },
  );
  child.on('error', () => {
    console.error('Could not start isolated development MongoDB.');
    process.exitCode = 1;
  });
  child.unref();
  closeSync(out);
  writeFileSync(
    resolve(directory, 'process.json'),
    JSON.stringify({ pid: child.pid, data, port }),
  );
  for (let attempt = 0; attempt < 60 && !connection; attempt++) {
    await new Promise((accept) => setTimeout(accept, 500));
    try {
      connection = await client();
    } catch {
      /* Wait for MongoDB listener. */
    }
  }
}
if (!connection)
  throw new Error(
    'Development MongoDB startup timed out; inspect .local/mongodb/mongodb.log',
  );
const options = await connection.db().admin().command({ getCmdLineOpts: 1 });
if (
  resolve(options.parsed.storage.dbPath) !== data ||
  (options.parsed.replication?.replSetName ||
    options.parsed.replication?.replSet) !== 'myt-dev'
)
  throw new Error('Port 27018 belongs to another MongoDB instance');
try {
  await connection.db().admin().command({ replSetGetStatus: 1 });
} catch (error) {
  if (error.code !== 94) throw error;
  await connection
    .db()
    .admin()
    .command({
      replSetInitiate: {
        _id: 'myt-dev',
        members: [{ _id: 0, host: `127.0.0.1:${port}` }],
      },
    });
}
let ready = false;
for (let attempt = 0; attempt < 60; attempt++) {
  const hello = await connection.db().admin().command({ hello: 1 });
  if (hello.isWritablePrimary) {
    ready = true;
    break;
  }
  await new Promise((accept) => setTimeout(accept, 500));
}
await connection.close();
if (!ready) throw new Error('Replica set did not elect a writable primary');
console.log(
  'Isolated development replica set ready on 127.0.0.1:27018. Existing service data was not touched.',
);
