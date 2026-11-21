import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import {
  branches,
  branchCurrency,
  permissions,
  rolePermissions,
} from '@myt/shared';
import {
  Branch,
  BranchSettings,
  User,
  Payment,
  Transaction,
  PermissionModel,
  RoleModel,
} from './models.js';

// Additive and rerunnable: never replaces prices, balances, identifiers or passwords.
export async function migrateOperations() {
  await mongoose.connection.transaction(async (session) => {
    for (const branch of branches.filter((b) => b.active)) {
      await Branch.updateOne(
        { _id: branch.id },
        { $setOnInsert: { name: branch.name, active: true } },
        { upsert: true, session },
      );
      await BranchSettings.updateOne(
        { branchId: branch.id },
        {
          $setOnInsert: {
            _id: randomUUID(),
            branchId: branch.id,
            code: `SET-${branch.id}`,
            createdBy: 'system:migration',
            version: 1,
            currency: branchCurrency(branch.id),
            paymentMethods: ['cash', 'bank', 'mobile'],
            offlinePayments: false,
            offlinePaymentLimitMinor: 100000,
            companyName: branch.name,
            address: '',
            telephone: '',
          },
        },
        { upsert: true, session },
      );
    }
    await User.updateMany(
      { role: 'admin' },
      { $addToSet: { branchIds: 'dollar' } },
      { session },
    );
    for (const permission of permissions)
      await PermissionModel.updateOne(
        { _id: permission },
        { $setOnInsert: { _id: permission } },
        { upsert: true, session },
      );
    for (const [role, grants] of Object.entries(rolePermissions))
      await RoleModel.updateOne(
        { _id: role },
        { $set: { permissions: grants } },
        { upsert: true, session },
      );
    // Existing payments inherit the currency of their own scoped transaction.
    const cursor = Payment.find({ currency: { $exists: false } })
      .session(session)
      .cursor();
    for await (const payment of cursor) {
      const transaction = await Transaction.findOne({
        _id: payment.transactionId,
        branchId: payment.branchId,
      }).session(session);
      if (!transaction)
        throw new Error(
          'Payment relation requires review; migration rolled back',
        );
      await Payment.collection.updateOne(
        {
          _id: payment._id as never,
          branchId: payment.branchId,
          currency: { $exists: false },
        },
        { $set: { currency: transaction.currency } },
        { session },
      );
    }
  });
}
