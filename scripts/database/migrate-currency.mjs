import { readFileSync } from 'node:fs';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { migrateCurrency } from '../../backend/dist/database/currencyMigration.js';
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
  await migrateCurrency();
  console.log(
    'Currency metadata migration applied; historical values and invoice snapshots preserved.',
  );
} catch {
  console.error(
    'Currency migration failed. Check database availability and permissions.',
  );
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
