import mongoose from 'mongoose';
import { branches, branchCurrency } from '@myt/shared';
import { Transaction, Payment, Expense, catalogModels } from './models.js';

// Additive, transactional and rerunnable. Only missing metadata is written.
// Historical Dollar records mean USD; all other authorized branches mean AFN.
export async function migrateCurrency() {
  await mongoose.connection.transaction(async (session) => {
    for (const branch of branches.filter((branch) => branch.active)) {
      const currency = branchCurrency(branch.id);
      for (const model of [
        Transaction,
        Expense,
        ...Object.values(catalogModels),
      ]) {
        await model.collection.updateMany(
          { branchId: branch.id, currency: { $exists: false } },
          { $set: { currency } },
          { session },
        );
      }
      const payments = Payment.find({
        branchId: branch.id,
        currency: { $exists: false },
      })
        .session(session)
        .cursor();
      for await (const payment of payments) {
        const parent = await Transaction.findOne({
          _id: payment.transactionId,
          branchId: branch.id,
        }).session(session);
        if (!parent)
          throw new Error(
            'Orphan payment requires review; currency migration rolled back',
          );
        await Payment.collection.updateOne(
          {
            _id: payment._id as never,
            branchId: branch.id,
            currency: { $exists: false },
          },
          { $set: { currency: parent.currency } },
          { session },
        );
      }
    }
  });
}
