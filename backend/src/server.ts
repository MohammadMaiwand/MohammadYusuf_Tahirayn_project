import 'dotenv/config';
import mongoose from 'mongoose';
import { createApp } from './app.js';
import { parseEnv } from './config/env.js';
import { initializeDatabase } from './database/bootstrap.js';
import { startNotificationJob } from './jobs/notifications.js';
const env = parseEnv(process.env);
try {
  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    autoIndex: env.NODE_ENV !== 'production',
  });
  await initializeDatabase();
  const stopJobs = startNotificationJob(() =>
    console.error(
      'Notification reconciliation failed; retrying on next interval.',
    ),
  );
  const server = createApp(
    env,
    () => mongoose.connection.readyState === 1,
  ).listen(env.PORT, env.HOST);
  server.on('error', () => {
    console.error('HTTP server failed; check host and port.');
    void mongoose.disconnect().then(() => process.exit(1));
  });
  for (const signal of ['SIGINT', 'SIGTERM'] as const)
    process.on(signal, () => {
      stopJobs();
      const timeout = setTimeout(() => process.exit(1), 10000);
      timeout.unref();
      server.close(() => {
        void mongoose.disconnect().then(() => process.exit(0));
      });
    });
} catch {
  console.error(
    'Database startup failed. Check MongoDB configuration and availability.',
  );
  process.exit(1);
}
