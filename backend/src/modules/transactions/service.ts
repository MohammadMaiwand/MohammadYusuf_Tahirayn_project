import type { ClientSession } from 'mongoose';
import {
  branchCurrency,
  transactionInput,
  transactionEditInput,
  moneyToMinor,
  transactionTotal,
  finalTotal,
  deliveryInput,
  calendarDay,
  type Command,
} from '@myt/shared';
import {
  catalogModels,
  Customer,
  Transaction,
  Payment,
  BranchSettings,
  type PackageSnapshot,
  type GuaranteeSnapshot,
} from '../../database/models.js';
import {
  requirePermission,
  has,
  ownFilter,
  type Context,
} from '../../security/identity.js';
import {
  base,
  found,
  audit,
  checkVersion,
  summary,
} from '../../services/context.js';
import { HttpError } from '../../utils/errors.js';
import { occupancyFilter } from '../catalog/availability.js';
export async function transactionCreate(
  ctx: Context,
  command: Command,
  session: ClientSession,
  offline = false,
) {
  requirePermission(ctx.actor, 'transactions.create');
  const data = transactionInput.parse(command.data);
  const customer = found(
    await Customer.findOne({
      _id: data.customerId,
      branchId: ctx.branchId,
    }).session(session),
  );
  const product = found(
    await catalogModels.products
      .findOne({
        _id: data.productId,
        branchId: ctx.branchId,
        status: 'active',
      })
      .session(session),
  );
  const settings = found(
    await BranchSettings.findOne({ branchId: ctx.branchId }).session(session),
  );
  const currency = data.currency || settings.currency;
  const packages: PackageSnapshot[] = [];
  const ids = new Set<string>();
  for (const selected of data.packages) {
    if (ids.has(selected.itemId)) throw new HttpError(400, 'duplicate_package');
    ids.add(selected.itemId);
    const item = found(
      await catalogModels['package-items']
        .findOne({
          _id: selected.itemId,
          branchId: ctx.branchId,
          status: 'active',
        })
        .session(session),
    );
    if ((item.currency || branchCurrency(ctx.branchId)) !== currency)
      throw new HttpError(422, 'currency_mismatch');
    packages.push({
      id: item._id,
      code: item.code,
      name: item.name,
      color: item.color,
      priceMinor: item.priceMinor,
      quantity: selected.quantity,
    });
  }
  const agreedMinor = moneyToMinor(data.agreedPrice);
  const packageTotal = transactionTotal(agreedMinor, packages);
  let totalMinor: number;
  try {
    totalMinor = finalTotal(
      agreedMinor,
      packages,
      moneyToMinor(data.discount),
      moneyToMinor(data.charges),
    );
  } catch {
    throw new HttpError(422, 'invalid_amount');
  }
  const advance = moneyToMinor(data.advance);
  if (
    offline &&
    advance > 0 &&
    (!settings.offlinePayments ||
      currency !== settings.currency ||
      advance > settings.offlinePaymentLimitMinor)
  )
    throw new HttpError(403, 'offline_payment_denied');
  if (totalMinor <= 0) throw new HttpError(400, 'invalid_amount');
  if (advance > totalMinor && !has(ctx.actor, 'payments.overpay'))
    throw new HttpError(422, 'overpayment');
  if (advance > 0) {
    requirePermission(ctx.actor, 'payments.create');
    if (!settings.paymentMethods.includes(data.paymentMethod))
      throw new HttpError(400, 'invalid_payment_method');
  }
  const now = new Date();
  const orderAt = data.orderAt ? new Date(data.orderAt) : now;
  if (
    Math.floor((orderAt.getTime() + 16200000) / 86400000) !==
      Math.floor((now.getTime() + 16200000) / 86400000) &&
    Math.abs(orderAt.getTime() - now.getTime()) >
      (offline ? 8 * 3600000 : 60000) &&
    !has(ctx.actor, 'transactions.backdate')
  )
    throw new HttpError(403, 'backdate_denied');
  let guarantee: GuaranteeSnapshot | null = null;
  if (data.guarantee) {
    const item = found(
      await catalogModels.guarantees
        .findOne({
          _id: data.guarantee.typeId,
          branchId: ctx.branchId,
          status: 'active',
        })
        .session(session),
    );
    if (
      data.guarantee.details &&
      item.guaranteeType !== 'manual' &&
      !has(ctx.actor, 'guarantees.sensitive')
    )
      throw new HttpError(403, 'guarantee_details_denied');
    if (item.guaranteeType === 'manual' && !data.guarantee.details)
      throw new HttpError(400, 'guarantee_details_required');
    guarantee = {
      typeId: item._id,
      name: item.name,
      type: item.guaranteeType,
      details: data.guarantee.details,
      receivedAt: now,
      returnedAt: null,
      status: 'received',
    };
  }
  const start = new Date(data.reservationAt);
  const end = data.returnDueAt ? new Date(data.returnDueAt) : null;
  // The date picker stores plain calendar days at Kabul midnight, so a same-day
  // return is valid. Only a return before the reservation day is rejected.
  if (end && (data.type !== 'rental' || calendarDay(end) < calendarDay(start)))
    throw new HttpError(422, 'invalid_return_date');
  // Every booking writes the same physical item inside the transaction. MongoDB
  // retries a concurrent write with a fresh snapshot before checking overlaps.
  await catalogModels.products.updateOne(
    { _id: product._id, branchId: ctx.branchId },
    { $inc: { version: 1 } },
    { session },
  );
  const occupied = await Transaction.exists(
    occupancyFilter(
      ctx.branchId,
      product._id,
      data.type === 'purchase' ? now : start,
      end,
      data.type === 'purchase',
    ),
  ).session(session);
  if (occupied) throw new HttpError(409, 'reservation_conflict');
  const [record] = await Transaction.create(
    [
      {
        ...base(ctx, 'TXN', data.id),
        customerId: customer._id,
        customerName: customer.fullName,
        product: {
          id: product._id,
          code: product.code,
          clothingId: product.clothingId,
          photoId: product.photoId,
          name: product.name,
          productType: product.productType,
          brand: product.brand,
          color: product.color,
          originalMinor: product.priceMinor,
          currency: product.currency || branchCurrency(ctx.branchId),
        },
        packages,
        guarantee,
        type: data.type,
        agreedMinor,
        discountMinor: moneyToMinor(data.discount),
        chargesMinor: moneyToMinor(data.charges),
        packageMinor: packageTotal - agreedMinor,
        totalMinor,
        paidMinor: advance,
        currency,
        orderAt,
        reservationAt: new Date(data.reservationAt),
        returnDueAt: end,
        status: 'pending',
        notes: data.notes,
        deliveryNotes: '',
      },
    ],
    { session },
  );
  if (advance > 0) {
    const [payment] = await Payment.create(
      [
        {
          ...base(ctx, 'PAY'),
          transactionId: record!._id,
          customerId: customer._id,
          currency: record!.currency,
          reference: '',
          amountMinor: advance,
          origin: 'advance',
          kind: 'payment',
          reversalOf: null,
          method: data.paymentMethod,
          paymentAt: now,
          notes: '',
          employeeName: ctx.actor.name,
        },
      ],
      { session },
    );
    await audit(
      ctx,
      session,
      command.deviceId,
      'payment.advance',
      'payments',
      payment!._id,
      null,
      { amountMinor: advance, transactionId: record!._id },
    );
  }
  await audit(
    ctx,
    session,
    command.deviceId,
    command.action,
    'transactions',
    record!._id,
    null,
    summary(record!),
  );
  return record!.toObject();
}
export async function deliveryUpdate(
  ctx: Context,
  command: Command,
  session: ClientSession,
) {
  requirePermission(ctx.actor, 'delivery.write');
  const data = deliveryInput.parse(command.data);
  const record = found(
    await Transaction.findOne({
      _id: command.targetId,
      branchId: ctx.branchId,
      ...ownFilter(ctx),
    }).session(session),
  );
  checkVersion(record, data.expectedVersion);
  const allowed: Record<string, string[]> = {
    pending: ['ready', 'cancelled'],
    ready: ['pending', 'delivered', 'cancelled'],
    delivered: record.type === 'rental' ? ['returned'] : [],
    returned: [],
    cancelled: [],
  };
  if (
    !allowed[record.status]?.includes(data.status) &&
    !(
      record.status === data.status &&
      data.returnGuarantee &&
      record.guarantee?.status === 'received'
    )
  )
    throw new HttpError(422, 'invalid_status_transition');
  if (data.status === 'delivered' && record.paidMinor < record.totalMinor)
    requirePermission(ctx.actor, 'delivery.unpaid');
  if (data.status === 'cancelled' && record.paidMinor !== 0)
    throw new HttpError(422, 'reverse_payments_before_cancellation');
  const before = summary(record);
  record.status = data.status;
  record.deliveryNotes = data.notes;
  record.version++;
  if (data.status === 'delivered') {
    record.deliveredAt = new Date();
    record.deliveredBy = ctx.actor.subject;
  }
  if (data.status === 'returned') record.returnedAt = new Date();
  if (data.returnGuarantee && record.guarantee) {
    if (
      !['returned', 'cancelled'].includes(data.status) &&
      !(data.status === 'delivered' && record.type === 'purchase')
    )
      throw new HttpError(422, 'guarantee_return_not_allowed');
    record.guarantee = {
      ...record.guarantee,
      returnedAt: new Date(),
      status: 'returned',
    };
  }
  await record.save({ session });
  await audit(
    ctx,
    session,
    command.deviceId,
    command.action,
    'transactions',
    record._id,
    before,
    summary(record),
  );
  return record.toObject();
}

export async function transactionUpdate(
  ctx: Context,
  command: Command,
  session: ClientSession,
) {
  requirePermission(ctx.actor, 'transactions.update');
  const data = transactionEditInput.parse(command.data);
  const record = found(
    await Transaction.findOne({
      _id: command.targetId,
      branchId: ctx.branchId,
      ...ownFilter(ctx),
    }).session(session),
  );
  checkVersion(record, data.expectedVersion);
  if (!['pending', 'ready'].includes(record.status))
    throw new HttpError(422, 'invalid_status_transition');
  let total: number;
  try {
    total = finalTotal(
      moneyToMinor(data.agreedPrice),
      record.packages,
      data.discount === undefined
        ? record.discountMinor || 0
        : moneyToMinor(data.discount),
      data.charges === undefined
        ? record.chargesMinor || 0
        : moneyToMinor(data.charges),
    );
  } catch {
    throw new HttpError(422, 'invalid_amount');
  }
  if (total <= 0 || total < record.paidMinor)
    throw new HttpError(422, 'total_below_paid');
  const start = new Date(data.reservationAt);
  if (
    record.returnDueAt &&
    calendarDay(start) > calendarDay(record.returnDueAt)
  )
    throw new HttpError(422, 'invalid_return_date');
  if (record.reservationAt.getTime() !== start.getTime()) {
    await catalogModels.products.updateOne(
      { _id: record.product.id, branchId: ctx.branchId },
      { $inc: { version: 1 } },
      { session },
    );
    const filter = occupancyFilter(
      ctx.branchId,
      record.product.id,
      record.type === 'purchase' ? new Date() : start,
      record.returnDueAt || null,
      record.type === 'purchase',
    );
    if (
      await Transaction.exists({ ...filter, _id: { $ne: record._id } }).session(
        session,
      )
    )
      throw new HttpError(409, 'reservation_conflict');
  }
  const before = {
    ...summary(record),
    reservationAt: record.reservationAt,
    totalMinor: record.totalMinor,
  };
  record.agreedMinor = moneyToMinor(data.agreedPrice);
  record.totalMinor = total;
  if (data.discount !== undefined)
    record.discountMinor = moneyToMinor(data.discount);
  if (data.charges !== undefined)
    record.chargesMinor = moneyToMinor(data.charges);
  record.reservationAt = start;
  record.notes = data.notes;
  record.version++;
  await record.save({ session });
  await audit(
    ctx,
    session,
    command.deviceId,
    command.action,
    'transactions',
    record._id,
    before,
    { ...summary(record), reservationAt: start, totalMinor: total },
  );
  return record.toObject();
}
