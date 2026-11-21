import { Expense, PermissionModel, RoleModel } from './models.js';

// Additive migration: creates only the new collection/indexes and permission metadata.
// No existing records/indexes are dropped or rewritten; safe to rerun.
export async function migrateExpenses() {
  await Expense.createCollection();
  await Expense.createIndexes();
  for (const permission of ['expenses.read', 'expenses.create']) {
    await PermissionModel.updateOne(
      { _id: permission },
      { $setOnInsert: { _id: permission } },
      { upsert: true },
    );
  }
  for (const role of ['admin', 'manager', 'employee']) {
    await RoleModel.updateOne(
      { _id: role },
      {
        $addToSet: {
          permissions: { $each: ['expenses.read', 'expenses.create'] },
        },
      },
      { upsert: true },
    );
  }
}
