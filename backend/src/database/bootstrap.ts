import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import {
  branches,
  permissions,
  rolePermissions,
  branchCurrency,
} from '@myt/shared';
import {
  allModels,
  Branch,
  BranchSettings,
  catalogModels,
  PermissionModel,
  RoleModel,
} from './models.js';

export async function initializeDatabase() {
  const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== 'isdbgrid')
    throw new Error(
      'MongoDB replica set required for atomic financial operations',
    );
  for (const model of allModels) {
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
      { $setOnInsert: { permissions: grants } },
      { upsert: true },
    );
  for (const branch of branches.filter((b) => b.active)) {
    await Branch.updateOne(
      { _id: branch.id },
      { $setOnInsert: { name: branch.name, active: true } },
      { upsert: true },
    );
    await BranchSettings.updateOne(
      { branchId: branch.id },
      {
        $setOnInsert: {
          _id: randomUUID(),
          branchId: branch.id,
          code: `SET-${branch.id}`,
          createdBy: 'system:bootstrap',
          version: 1,
          currency: branchCurrency(branch.id),
          paymentMethods: ['cash', 'bank', 'mobile'],
          offlinePayments: false,
          offlinePaymentLimitMinor: 100000,
          companyName: 'شرکت تجارتی محمد یوسف طاهریان',
          address: '',
          telephone: '',
        },
      },
      { upsert: true },
    );
    for (const type of [
      'tazkira',
      'ring',
      'necklace',
      'cash',
      'telephone',
      'manual',
    ])
      await catalogModels.guarantees.updateOne(
        { branchId: branch.id, guaranteeType: type, normalizedName: type },
        {
          $setOnInsert: {
            _id: randomUUID(),
            branchId: branch.id,
            code: `GUA-${type}`,
            createdBy: 'system:bootstrap',
            version: 1,
            name: type,
            normalizedName: type,
            guaranteeType: type,
            productType: '',
            brand: '',
            color: '',
            priceMinor: 0,
            quantity: 1,
            description: '',
            status: 'active',
            categoryId: null,
          },
        },
        { upsert: true },
      );
  }
}
