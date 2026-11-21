import mongoose from 'mongoose';

export default async function setup() {
  const database = process.env.MYT_UI_DATABASE;
  if (!database || !/^myt_ui_test_[a-f0-9]{32}$/.test(database))
    throw new Error('Unsafe UI test database refused');
  const migrationPath = '../../backend/dist/database/expensesMigration.js';
  const { migrateExpenses } = await import(migrationPath);
  const authPath = '../../backend/dist/database/authMigration.js';
  const { migrateAuth } = await import(authPath);
  const clothingPath = '../../backend/dist/database/clothingMigration.js';
  const { migrateClothing } = await import(clothingPath);
  try {
    await mongoose.connect('mongodb://127.0.0.1:27018/?replicaSet=myt-dev', {
      dbName: database,
      autoIndex: false,
      autoCreate: false,
    });
    await migrateExpenses();
    await migrateAuth();
    await migrateClothing();
    const alterationPath =
      '../../backend/dist/database/alterationsMigration.js';
    const { migrateAlterations } = await import(alterationPath);
    await migrateAlterations();
    const advertisementPath =
      '../../backend/dist/database/advertisementsMigration.js';
    const { migrateAdvertisements } = await import(advertisementPath);
    await migrateAdvertisements();
    if (process.env.MYT_AUTH_E2E === 'true') {
      const corePath = '../../backend/dist/modules/auth/core.js';
      const modelPath = '../../backend/dist/database/models.js';
      const { hashPassword, activeBranches } = await import(corePath);
      const { User } = await import(modelPath);
      const passwordHash = await hashPassword('Browser-Password-Secure-123');
      for (const role of ['admin', 'manager', 'employee'])
        await User.create({
          _id: crypto.randomUUID(),
          name: `${role} Browser`,
          normalizedEmail: `${role}@browser.local`,
          passwordHash,
          role,
          branchIds: role === 'admin' ? activeBranches : ['sham-royal'],
          assignedBranchId: role === 'admin' ? null : 'sham-royal',
          allow: [],
          deny: [],
          disabled: false,
          accountStatus: 'active',
          language: 'en',
          createdBy: 'test',
          updatedBy: 'test',
        });
    }
  } finally {
    await mongoose.disconnect();
  }
}
