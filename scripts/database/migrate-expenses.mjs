import { readFileSync } from 'node:fs';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { migrateExpenses } from '../../backend/dist/database/expensesMigration.js';
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
  await migrateExpenses();
  console.log(
    'Expenses migration applied: additive collection, indexes and permissions; existing data preserved.',
  );
} catch {
  console.error(
    'Expenses migration failed. Check database availability and permissions.',
  );
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
