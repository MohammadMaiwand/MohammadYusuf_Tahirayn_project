import { readFileSync } from 'node:fs';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { migrateAlterations } from '../../backend/dist/database/alterationsMigration.js';
const values = {
  ...dotenv.parse(readFileSync(new URL('../../backend/.env', import.meta.url))),
  ...process.env,
};
if (!values.MONGODB_URI) throw new Error('MONGODB_URI is required');
try {
  await mongoose.connect(values.MONGODB_URI, {
    autoIndex: false,
    autoCreate: false,
    serverSelectionTimeoutMS: 5000,
  });
  await migrateAlterations();
  console.log(
    'Alteration collection/indexes and permission metadata applied; existing records preserved.',
  );
} catch {
  console.error(
    'Alteration migration failed. Check database availability and permissions.',
  );
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
