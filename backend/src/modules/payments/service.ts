import type { ClientSession } from 'mongoose';
import { z } from 'zod';
import {
  paymentInput,
  moneyToMinor,
  safeMinor,
  note,
  type Command,
} from '@myt/shared';
import { Transaction, Payment, BranchSettings } from '../../database/models.js';
import {
  requirePermission,
  has,
  ownFilter,
  type Context,
} from '../../security/identity.js';
import {
  audit,
  base,
  checkVersion,
  found,
  summary,
} from '../../services/context.js';
import { HttpError } from '../../utils/errors.js';
export async function paymentCreate(
  ctx: Context,
  command: Command,
  session: ClientSession,
  offline: boolean,
) {
  requirePermission(ctx.actor, 'payments.create');
  const data = paymentInput.parse(command.data);
  const record = found(
    await Transaction.findOne({
      _id: data.transactionId,
      branchId: ctx.branchId,
      ...ownFilter(ctx),
    }).session(session),
  );
  checkVersion(record, data.expectedVersion);
  if ('currency' in data && data.currency && data.currency !== record.currency)
    throw new HttpError(422, 'currency_mismatch');
  if (record.status === 'cancelled')
    throw new HttpError(422, 'transaction_cancelled');
  const settings = found(
    await BranchSettings.findOne({ branchId: ctx.branchId }).session(session),
  );
  const amountMinor = moneyToMinor(data.amount);
  if (amountMinor <= 0 || !settings.paymentMethods.includes(data.method))
    throw new HttpError(422, 'invalid_payment');
  if (
    offline &&
    (!settings.offlinePayments ||
      record.currency !== settings.currency ||
      amountMinor > settings.offlinePaymentLimitMinor)
  )
    throw new HttpError(403, 'offline_payment_denied');
  const paidMinor = safeMinor(BigInt(record.paidMinor) + BigInt(amountMinor));
  if (paidMinor > record.totalMinor && !has(ctx.actor, 'payments.overpay'))
    throw new HttpError(422, 'overpayment');
  const before = summary(record);
  record.paidMinor = paidMinor;
  record.version++;
  const paymentAt = data.paymentAt ? new Date(data.paymentAt) : new Date();
  if (
    Math.floor((paymentAt.getTime() + 16200000) / 86400000) !==
      Math.floor((Date.now() + 16200000) / 86400000) &&
    Math.abs(paymentAt.getTime() - Date.now()) >
      (offline ? 8 * 3600000 : 60000) &&
    !has(ctx.actor, 'transactions.backdate')
  )
    throw new HttpError(403, 'backdate_denied');
  await record.save({ session });
  const [payment] = await Payment.create(
    [
      {
        ...base(ctx, 'PAY', data.id),
        transactionId: record._id,
        customerId: record.customerId,
        currency: record.currency,
        reference: data.reference,
        amountMinor,
        method: data.method,
        paymentAt,
        notes: data.notes,
        kind: 'payment',
        origin: 'additional',
        reversalOf: null,
        employeeName: ctx.actor.name,
      },
    ],
    { session },
  );
  await audit(
    ctx,
    session,
    command.deviceId,
    command.action,
    'payments',
    payment!._id,
    null,
    { transactionId: record._id, amountMinor },
  );
  await audit(
    ctx,
    session,
    command.deviceId,
    'transaction.balance',
    'transactions',
    record._id,
    before,
    summary(record),
  );
  return { payment: payment!.toObject(), transaction: record.toObject() };
}
export async function paymentReverse(
  ctx: Context,
  command: Command,
  session: ClientSession,
) {
  requirePermission(ctx.actor, 'payments.reverse');
  const data = z
    .object({
      expectedVersion: z.number().int().min(1),
      reason: note.refine((value) => value.length > 2, 'reason_required'),
    })
    .strict()
    .parse(command.data);
  const original = found(
    await Payment.findOne({
      _id: command.targetId,
      branchId: ctx.branchId,
      kind: 'payment',
    }).session(session),
  );
  if (
    await Payment.exists({
      branchId: ctx.branchId,
      reversalOf: original._id,
    }).session(session)
  )
    throw new HttpError(409, 'payment_already_reversed');
  const record = found(
    await Transaction.findOne({
      _id: original.transactionId,
      branchId: ctx.branchId,
      ...ownFilter(ctx),
    }).session(session),
  );
  checkVersion(record, data.expectedVersion);
  const before = summary(record);
  record.paidMinor = safeMinor(
    BigInt(record.paidMinor) - BigInt(original.amountMinor),
  );
  record.version++;
  await record.save({ session });
  const [payment] = await Payment.create(
    [
      {
        ...base(ctx, 'REV'),
        transactionId: record._id,
        customerId: record.customerId,
        currency: record.currency,
        reference: original.reference || '',
        amountMinor: -original.amountMinor,
        method: original.method,
        paymentAt: new Date(),
        notes: data.reason,
        kind: 'reversal',
        origin: 'reversal',
        reversalOf: original._id,
        employeeName: ctx.actor.name,
      },
    ],
    { session },
  );
  await audit(
    ctx,
    session,
    command.deviceId,
    command.action,
    'payments',
    payment!._id,
    null,
    { reversalOf: original._id, amountMinor: -original.amountMinor },
  );
  await audit(
    ctx,
    session,
    command.deviceId,
    'transaction.balance',
    'transactions',
    record._id,
    before,
    summary(record),
  );
  return { payment: payment!.toObject(), transaction: record.toObject() };
}
