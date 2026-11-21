import { User, RoleModel, PermissionModel, Notification } from './models.js';
import { authModels } from '../modules/auth/models.js';
import { permissions, rolePermissions } from '@myt/shared';
export async function migrateAuth() {
  // Legacy role normalization is explicit and preserves record IDs/business ownership.
  await User.collection.updateMany(
    { role: 'user' },
    { $set: { role: 'employee' } },
  );
  await RoleModel.deleteOne({ _id: 'user' });
  await User.collection.updateMany(
    { accountStatus: { $exists: false } },
    { $set: { accountStatus: 'deactivated' } },
  );
  await User.collection.createIndex(
    { normalizedEmail: 1 },
    {
      unique: true,
      partialFilterExpression: { normalizedEmail: { $type: 'string' } },
    },
  );
  // Replace only the legacy reminder index; retain all reminder data and new uniqueness.
  await Notification.createIndexes();
  const indexes = await Notification.collection.indexes();
  const legacy = indexes.find(
    (index) =>
      index.name === 'branchId_1_transactionId_1_type_1_reservationAt_1' &&
      index.unique &&
      !index.partialFilterExpression,
  );
  if (legacy?.name) await Notification.collection.dropIndex(legacy.name);
  for (const model of authModels) {
    await model.createCollection();
    await model.createIndexes();
  }
  for (const permission of permissions)
    await PermissionModel.updateOne(
      { _id: permission },
      { $setOnInsert: { _id: permission } },
      { upsert: true },
    );
  for (const [role, grants] of Object.entries(rolePermissions))
    await RoleModel.updateOne(
      { _id: role },
      { $set: { permissions: grants } },
      { upsert: true },
    );
}
