import { permissions, rolePermissions } from '@myt/shared';
import { PermissionModel, RoleModel } from './models.js';
import {
  Advertisement,
  AdvertisementImage,
} from '../modules/advertisements/model.js';

// Additive migration: creates advertisement indexes, preserves existing
// company-wide records and enables branch-owned ads for managers.
export async function migrateAdvertisements() {
  await Advertisement.createCollection();
  await Advertisement.updateMany(
    { branchId: { $exists: false } },
    { $set: { branchId: null } },
  );
  await Advertisement.createIndexes();
  await AdvertisementImage.createCollection();
  await AdvertisementImage.updateMany(
    { branchId: { $exists: false } },
    { $set: { branchId: null } },
  );
  await AdvertisementImage.createIndexes();
  for (const permission of permissions.filter(
    (p) => p === 'advertisements.manage',
  ))
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
