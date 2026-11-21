import { permissions, rolePermissions } from '@myt/shared';
import { PermissionModel, RoleModel } from './models.js';
import { Alteration } from '../modules/alterations/model.js';
import { ClothingPhoto } from '../modules/catalog/photos.js';
export async function migrateAlterations() {
  await Alteration.createCollection();
  await Alteration.createIndexes();
  await ClothingPhoto.createCollection();
  for (const permission of permissions.filter((p) =>
    p.startsWith('alterations.'),
  ))
    await PermissionModel.updateOne(
      { _id: permission },
      { $setOnInsert: { _id: permission } },
      { upsert: true },
    );
  for (const [role, grants] of Object.entries(rolePermissions))
    await RoleModel.updateOne(
      { _id: role },
      {
        $addToSet: {
          permissions: {
            $each: grants.filter((p) => p.startsWith('alterations.')),
          },
        },
      },
      { upsert: true },
    );
}
