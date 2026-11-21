import type { ClientSession } from 'mongoose';
import { z } from 'zod';
import { uuid, type Command } from '@myt/shared';
import {
  Transaction,
  Customer,
  Payment,
  Invoice,
  BranchSettings,
} from '../../database/models.js';
import {
  requirePermission,
  has,
  ownFilter,
  type Context,
} from '../../security/identity.js';
import { base, found, audit } from '../../services/context.js';
export async function issueInvoice(
  ctx: Context,
  command: Command,
  session: ClientSession,
) {
  requirePermission(ctx.actor, 'invoices.issue');
  requirePermission(ctx.actor, 'invoices.read');
  requirePermission(ctx.actor, 'transactions.read.own');
  const data = z.object({ transactionId: uuid }).strict().parse(command.data);
  const transaction = found(
    await Transaction.findOne({
      _id: data.transactionId,
      branchId: ctx.branchId,
      ...ownFilter(ctx),
    })
      .session(session)
      .lean(),
  );
  const customer = found(
    await Customer.findOne({
      _id: transaction.customerId,
      branchId: ctx.branchId,
    })
      .session(session)
      .lean(),
  );
  const payments = await Payment.find({
    branchId: ctx.branchId,
    transactionId: transaction._id,
  })
    .sort({ createdAt: 1, _id: 1 })
    .session(session)
    .lean();
  const settings = found(
    await BranchSettings.findOne({ branchId: ctx.branchId })
      .session(session)
      .lean(),
  );
  if (
    transaction.guarantee &&
    transaction.guarantee.type !== 'manual' &&
    !has(ctx.actor, 'guarantees.sensitive')
  )
    transaction.guarantee.details = '';
  const [invoice] = await Invoice.create(
    [
      {
        ...base(ctx, 'INV'),
        transactionId: transaction._id,
        customerId: customer._id,
        transactionVersion: transaction.version,
        issuedBy: ctx.actor.name,
        snapshot: {
          transaction,
          customer,
          payments,
          settings: {
            companyName: settings.companyName,
            address: settings.address,
            telephone: settings.telephone,
            currency: settings.currency,
          },
          employeeName: ctx.actor.name,
        },
      },
    ],
    { session },
  );
  await audit(
    ctx,
    session,
    command.deviceId,
    command.action,
    'invoices',
    invoice!._id,
    null,
    { transactionId: transaction._id, transactionVersion: transaction.version },
  );
  return invoice!.toObject();
}
