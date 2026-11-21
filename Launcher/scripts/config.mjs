import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

const root = resolve(import.meta.dirname, '../..');
const envFile = resolve(root, 'backend/.env');
if (!existsSync(envFile)) {
  console.error(
    'Missing backend/.env. Copy backend/.env.example and configure it.',
  );
  process.exit(1);
}
const env = { ...dotenv.parse(readFileSync(envFile)), ...process.env };
if (process.argv[2] === 'probe') {
  try {
    await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    await mongoose.connection.db.admin().ping();
    await mongoose.disconnect();
  } catch {
    console.error(
      'MongoDB is unavailable. Check configuration, credentials and network.',
    );
    process.exit(1);
  }
} else {
  try {
    const { parseEnv } = await import('../../backend/dist/config/env.js');
    const validated = parseEnv(env);
    const frontend = new URL(validated.FRONTEND_URL);
    if (
      frontend.protocol !== 'http:' ||
      !['localhost', '127.0.0.1'].includes(frontend.hostname) ||
      frontend.username ||
      frontend.password ||
      frontend.pathname !== '/' ||
      frontend.search ||
      frontend.hash
    )
      throw new Error();
    if (!['localhost', '127.0.0.1'].includes(validated.HOST)) throw new Error();
    const localMongo =
      /^mongodb:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/|$)/.test(
        validated.MONGODB_URI,
      );
    console.log(
      JSON.stringify({
        port: validated.PORT,
        host: validated.HOST,
        frontendPort: Number(frontend.port || 80),
        frontendUrl: frontend.origin,
        localMongo,
        devMongo:
          env.MONGODB_DEV_MANAGED === 'true' &&
          validated.NODE_ENV === 'development' &&
          /^mongodb:\/\/127\.0\.0\.1:27018\//.test(validated.MONGODB_URI) &&
          new URL(validated.MONGODB_URI).searchParams.get('replicaSet') ===
            'myt-dev',
        serviceName: env.MONGODB_SERVICE_NAME || '',
      }),
    );
  } catch {
    console.error(
      'Invalid launcher configuration. Check environment keys and local HTTP frontend URL.',
    );
    process.exit(1);
  }
}
