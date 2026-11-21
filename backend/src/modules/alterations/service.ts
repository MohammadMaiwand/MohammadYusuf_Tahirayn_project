import type { ClientSession } from 'mongoose';
import { z } from 'zod';
import {
  alterationInput,
  alterationStatusInput,
  alterationStatuses,
  alterationDuration,
  calendarDay,
  moneyToMinor,
  type Command,
} from '@myt/shared';
import { Alteration } from './model.js';
import {
  User,
  Customer,
  Transaction,
  Notification,
  BranchSettings,
} from '../../database/models.js';
import { ClothingPhoto } from '../catalog/photos.js';
import {
  context,
  requirePermission,
  has,
  ownFilter,
  type Context,
} from '../../security/identity.js';
import { audit, base, checkVersion, found } from '../../services/context.js';
import { HttpError } from '../../utils/errors.js';
import { escaped } from '../../validators/query.js';
export const alterationQuery = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().trim().max(100).default(''),
  customerId: z.uuid().optional(),
  transactionId: z.uuid().optional(),
  garmentId: z.string().max(64).optional(),
  tailor: z.string().max(160).optional(),
  status: z.enum(alterationStatuses).optional(),
  currency: z.enum(['AFN', 'USD']).optional(),
  startFrom: z.iso.datetime({ offset: true }).optional(),
  startTo: z.iso.datetime({ offset: true }).optional(),
  deliveryFrom: z.iso.datetime({ offset: true }).optional(),
  deliveryTo: z.iso.datetime({ offset: true }).optional(),
});
export function alterationScope(ctx: Context) {
  context(ctx.actor, ctx.branchId);
  requirePermission(ctx.actor, 'alterations.read');
  return {
    branchId: ctx.branchId,
    ...(!has(ctx.actor, 'alterations.read.all')
      ? { createdBy: ctx.actor.subject }
      : {}),
  };
}
export function showAlteration<T extends object>(ctx: Context, value: T): T {
  const row = JSON.parse(JSON.stringify(value));
  if (!has(ctx.actor, 'alterations.financial')) {
    delete row.originalMinor;
    delete row.alterationMinor;
  }
  return row;
}
export async function alterationList(
  ctx: Context,
  query: z.infer<typeof alterationQuery>,
) {
  const filter: Record<string, unknown> = alterationScope(ctx);
  for (const field of ['customerId', 'transactionId', 'currency'] as const)
    if (query[field]) filter[field] = query[field];
  if (query.q)
    filter.$or = [
      'garmentId',
      'garmentName',
      'customerName',
      'telephone',
      'tailorName',
    ].map((field) => ({
      [field]: { $regex: escaped(query.q), $options: 'i' },
    }));
  if (query.garmentId)
    filter.garmentId = { $regex: escaped(query.garmentId), $options: 'i' };
  if (query.tailor)
    filter.tailorName = { $regex: escaped(query.tailor), $options: 'i' };
  for (const [field, from, to] of [
    ['startAt', query.startFrom, query.startTo],
    ['expectedAt', query.deliveryFrom, query.deliveryTo],
  ] as const) {
    if (from || to)
      filter[field] = {
        ...(from ? { $gte: new Date(from) } : {}),
        ...(to ? { $lt: new Date(to) } : {}),
      };
  }
  const today = new Date(calendarDay(new Date()) * 86400000 - 16200000);
  const terminal = ['delivered', 'cancelled'];
  const overdue = { status: { $nin: terminal }, expectedAt: { $lt: today } };
  // Effective overdue status stays correct between scheduled runs.
  if (query.status === 'overdue') filter.$and = [overdue];
  else if (query.status) {
    filter.status = query.status;
    if (!terminal.includes(query.status))
      filter.$and = [{ expectedAt: { $gte: today } }];
  }
  const summaryFilter = { ...filter };
  delete summaryFilter.status;
  delete summaryFilter.$and;
  const [items, total, grouped, dueTomorrow, overdueCount] = await Promise.all([
    Alteration.find(filter)
      .sort({ createdAt: -1, _id: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Alteration.countDocuments(filter),
    Alteration.aggregate<{ _id: string; count: number }>([
      { $match: summaryFilter },
      {
        $group: {
          _id: {
            $cond: [
              {
                $and: [
                  { $not: [{ $in: ['$status', terminal] }] },
                  { $lt: ['$expectedAt', today] },
                ],
              },
              'overdue',
              '$status',
            ],
          },
          count: { $sum: 1 },
        },
      },
    ]),
    Alteration.countDocuments({
      ...summaryFilter,
      status: { $nin: terminal },
      expectedAt: {
        $gte: new Date(today.getTime() + 86400000),
        $lt: new Date(today.getTime() + 2 * 86400000),
      },
    }),
    Alteration.countDocuments({ ...summaryFilter, ...overdue }),
  ]);
  return {
    items: items.map((row) =>
      showAlteration(ctx, {
        ...row,
        status:
          !terminal.includes(row.status) && row.expectedAt < today
            ? 'overdue'
            : row.status,
      }),
    ),
    total,
    page: query.page,
    limit: query.limit,
    summary: {
      total: grouped.reduce((sum, row) => sum + row.count, 0),
      ...Object.fromEntries(grouped.map((row) => [row._id, row.count])),
      dueTomorrow,
      overdue: overdueCount,
    },
  };
}
export async function alterationDetail(
  ctx: Context,
  id: string,
  print = false,
) {
  if (print) requirePermission(ctx.actor, 'alterations.print');
  const row = found(
    await Alteration.findOne({ _id: id, ...alterationScope(ctx) }).lean(),
  );
  const company = await BranchSettings.findOne({ branchId: ctx.branchId })
    .select('companyName address telephone')
    .lean();
  const overdue =
    !['delivered', 'cancelled'].includes(row.status) &&
    calendarDay(row.expectedAt) < calendarDay(new Date());
  return showAlteration(ctx, {
    ...row,
    status: overdue ? 'overdue' : row.status,
    company,
  });
}
export async function alterationWrite(
  ctx: Context,
  command: Command,
  session: ClientSession,
) {
  const creating = command.action === 'alteration.create';
  requirePermission(
    ctx.actor,
    creating ? 'alterations.create' : 'alterations.update',
  );
  requirePermission(ctx.actor, 'alterations.financial');
  const scope = alterationScope(ctx);
  const data = alterationInput.parse(command.data);
  requirePermission(ctx.actor, 'customers.read');
  const customer = found(
    await Customer.findOne({
      _id: data.customerId,
      branchId: ctx.branchId,
    }).session(session),
  );
  if (data.transactionId) {
    requirePermission(ctx.actor, 'transactions.read.own');
    const parent = found(
      await Transaction.findOne({
        _id: data.transactionId,
        customerId: customer._id,
        branchId: ctx.branchId,
        ...ownFilter(ctx),
      }).session(session),
    );
    if (
      moneyToMinor(data.originalPrice) !== parent.product.originalMinor ||
      (data.originalCurrency || data.currency) !==
        (parent.product.currency || parent.currency)
    )
      throw new HttpError(422, 'alteration_original_locked');
  }
  if (data.tailorId) {
    const tailor = found(
      await User.findOne({
        _id: data.tailorId,
        branchIds: ctx.branchId,
        disabled: false,
        accountStatus: 'active',
      }).session(session),
    );
    data.tailorName = tailor.name;
  }
  if (data.photoId)
    found(
      await ClothingPhoto.findOne({
        _id: data.photoId,
        branchId: ctx.branchId,
        $or: [
          { purpose: { $ne: 'alteration' } },
          { createdBy: ctx.actor.subject },
          ...(has(ctx.actor, 'alterations.read.all')
            ? [{ purpose: 'alteration' }]
            : []),
        ],
      }).session(session),
    );
  const { id, originalPrice, alterationPrice, ...values } = data;
  const fields = {
    ...values,
    garmentId: data.garmentId.normalize('NFKC').toUpperCase(),
    customerName: customer.fullName,
    customerCode: customer.code,
    telephone: customer.telephone,
    whatsapp: customer.whatsapp,
    startAt: new Date(data.startAt),
    expectedAt: new Date(data.expectedAt),
    durationDays: alterationDuration(data.startAt, data.expectedAt),
    originalCurrency: data.originalCurrency || data.currency,
    originalMinor: moneyToMinor(originalPrice),
    alterationMinor: moneyToMinor(alterationPrice),
  };
  let record;
  if (creating) {
    [record] = await Alteration.create(
      [{ ...base(ctx, 'ALT', id), ...fields, status: 'pending' }],
      { session },
    );
  } else {
    record = found(
      await Alteration.findOne({ _id: command.targetId, ...scope }).session(
        session,
      ),
    );
    checkVersion(record, command.expectedVersion);
    if (['delivered', 'cancelled'].includes(record.status))
      throw new HttpError(422, 'invalid_status_transition');
    if (
      data.customerId !== record.customerId ||
      data.currency !== record.currency ||
      fields.originalMinor !== record.originalMinor ||
      fields.originalCurrency !== record.originalCurrency
    )
      throw new HttpError(422, 'alteration_original_locked');
    const before = {
      version: record.version,
      expectedAt: record.expectedAt,
      alterationMinor: record.alterationMinor,
    };
    record.set(fields);
    record.version++;
    if (
      record.status === 'overdue' &&
      calendarDay(record.expectedAt) >= calendarDay(new Date())
    )
      record.status = (record.overdueFrom ||
        'in_progress') as typeof record.status;
    await record.save({ session });
    await audit(
      ctx,
      session,
      command.deviceId,
      command.action,
      'alterations',
      record._id,
      before,
      {
        version: record.version,
        expectedAt: record.expectedAt,
        alterationMinor: record.alterationMinor,
      },
    );
  }
  if (creating)
    await audit(
      ctx,
      session,
      command.deviceId,
      command.action,
      'alterations',
      record!._id,
      null,
      {
        version: 1,
        currency: data.currency,
        alterationMinor: fields.alterationMinor,
      },
    );
  await Notification.updateMany(
    {
      branchId: ctx.branchId,
      alterationId: record!._id,
      resolved: false,
      reservationAt: { $ne: record!.expectedAt },
    },
    { $set: { resolved: true, deliveryStatus: 'resolved' } },
    { session },
  );
  return showAlteration(ctx, record!.toObject());
}
export async function alterationStatus(
  ctx: Context,
  command: Command,
  session: ClientSession,
) {
  requirePermission(ctx.actor, 'alterations.status');
  const data = alterationStatusInput.parse(command.data);
  const record = found(
    await Alteration.findOne({
      _id: command.targetId,
      ...alterationScope(ctx),
    }).session(session),
  );
  checkVersion(record, data.expectedVersion);
  if (['delivered', 'cancelled'].includes(record.status))
    throw new HttpError(422, 'invalid_status_transition');
  const before = { status: record.status, version: record.version };
  record.status = data.status;
  record.version++;
  record.deliveredAt = data.status === 'delivered' ? new Date() : null;
  await record.save({ session });
  if (['ready', 'delivered', 'cancelled'].includes(data.status))
    await Notification.updateMany(
      { branchId: ctx.branchId, alterationId: record._id, resolved: false },
      { $set: { resolved: true, deliveryStatus: 'resolved' } },
      { session },
    );
  await audit(
    ctx,
    session,
    command.deviceId,
    command.action,
    'alterations',
    record._id,
    before,
    { status: record.status, version: record.version },
  );
  return showAlteration(ctx, record.toObject());
}

export async function alterationReplay(ctx: Context, value: unknown) {
  const row = value as { _id: string };
  found(await Alteration.exists({ _id: row._id, ...alterationScope(ctx) }));
  return showAlteration(ctx, row);
}
