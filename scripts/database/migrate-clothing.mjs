import { readFileSync } from 'node:fs';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { migrateClothing } from '../../backend/dist/database/clothingMigration.js';
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
  await migrateClothing();
  console.log(
    'Clothing migration applied: additive photo collection and branch clothing ID index; existing data preserved.',
  );
} catch {
  console.error(
    'Clothing migration failed. Check database availability and permissions.',
  );
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
