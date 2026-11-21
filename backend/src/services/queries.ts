import { notificationAudience } from '../security/notificationAudience.js';
import type { FilterQuery, Model, PipelineStage } from 'mongoose';
import {
  catalogModels,
  Customer,
  Transaction,
  Payment,
  Invoice,
  Notification,
  BranchSettings,
  Device,
  AuditLog,
  User,
  Branch,
  type BaseRecord,
  type TransactionRecord,
} from '../database/models.js';
import { Alteration } from '../modules/alterations/model.js';
import {
  requirePermission,
  has,
  ownFilter,
  type Context,
} from '../security/identity.js';
import { found } from './context.js';
import { dateRange, escaped, type ListQuery } from '../validators/query.js';
import { branchCurrency, calendarDay, type CatalogType } from '@myt/shared';
import { HttpError } from '../utils/errors.js';
export function present<T>(value: T, ctx: Context): T {
  const output: T = JSON.parse(
    JSON.stringify(value, (_key, item) =>
      item && typeof item === 'object' && '$numberDecimal' in item
        ? item.$numberDecimal
        : item,
    ),
  );
  function redact(item: unknown) {
    if (!item || typeof item !== 'object') return;
    if (Array.isArray(item)) {
      item.forEach(redact);
      return;
    }
    const object = item as Record<string, unknown>;
    delete object.normalizedName;
    if (
      !has(ctx.actor, 'guarantees.sensitive') &&
      object.guarantee &&
      typeof object.guarantee === 'object'
    ) {
      const guarantee = object.guarantee as Record<string, unknown>;
      if (guarantee.type !== 'manual') guarantee.details = '';
    }
    Object.values(object).forEach(redact);
  }
  redact(output);
  return output;
}
async function paged<T extends BaseRecord>(
  model: Model<T>,
  filter: FilterQuery<T>,
  query: ListQuery,
) {
  const [items, total] = await Promise.all([
    model
      .find(filter)
      .sort({ [query.sort]: query.direction === 'asc' ? 1 : -1, _id: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    model.countDocuments(filter),
  ]);
  return { items, total, page: query.page, limit: query.limit };
}
export async function enrichNotifications<
  T extends {
    _id: string;
    branchId: string;
    transactionId?: string;
    alterationId?: string;
  },
>(items: T[], actor: Context['actor']) {
  if (!items.length) return items;
  const branchIds = [...new Set(items.map((item) => item.branchId))];
  const transactionIds = items
    .filter((item) => !item.alterationId && item.transactionId)
    .map((item) => item.transactionId!);
  const alterationIds = items.flatMap((item) =>
    item.alterationId ? [item.alterationId] : [],
  );
  const [transactions, alterations] = await Promise.all([
    transactionIds.length
      ? Transaction.find({
          _id: { $in: transactionIds },
          branchId: { $in: branchIds },
          ...(!has(actor, 'transactions.read.all')
            ? { createdBy: actor.subject }
            : {}),
        })
          .select('_id totalMinor currency')
          .lean()
      : [],
    alterationIds.length
      ? Alteration.find({
          _id: { $in: alterationIds },
          branchId: { $in: branchIds },
          ...(!has(actor, 'alterations.read.all')
            ? { createdBy: actor.subject }
            : {}),
        })
          .select('_id alterationMinor currency')
          .lean()
      : [],
  ]);
  const transactionById = new Map(
    transactions.map((record) => [record._id, record]),
  );
  const alterationById = new Map(
    alterations.map((record) => [record._id, record]),
  );
  return items.map((item) => {
    const alteration = item.alterationId
      ? alterationById.get(item.alterationId)
      : undefined;
    const transaction = item.transactionId
      ? transactionById.get(item.transactionId)
      : undefined;
    const amountMinor = alteration?.alterationMinor ?? transaction?.totalMinor;
    const currency = alteration?.currency ?? transaction?.currency;
    return {
      ...item,
      ...(amountMinor !== undefined && currency
        ? { amountMinor: String(amountMinor), currency }
        : {}),
    };
  });
}
export async function catalogList(
  ctx: Context,
  resource: CatalogType,
  query: ListQuery,
) {
  requirePermission(ctx.actor, 'catalog.read');
  const filter: Record<string, unknown> = { branchId: ctx.branchId };
  if (query.q)
    filter.$or = [
      {
        normalizedName: {
          $regex: `^${escaped(query.q.normalize('NFKC').toLowerCase())}`,
        },
      },
      { code: { $regex: `^${escaped(query.q.toUpperCase())}` } },
      {
        clothingId: {
          $regex: `^${escaped(query.q.normalize('NFKC').toUpperCase())}`,
        },
      },
    ];
  for (const field of ['status', 'brand', 'color', 'productType'] as const)
    if (query[field]) filter[field] = query[field];
  return present(await paged(catalogModels[resource], filter, query), ctx);
}
export async function customerList(ctx: Context, query: ListQuery) {
  requirePermission(ctx.actor, 'customers.read');
  const filter: Record<string, unknown> = { branchId: ctx.branchId };
  if (query.q)
    filter.$or = [
      {
        normalizedName: {
          $regex: `^${escaped(query.q.normalize('NFKC').toLowerCase())}`,
        },
      },
      { telephone: { $regex: `^${escaped(query.q)}` } },
      { code: { $regex: `^${escaped(query.q.toUpperCase())}` } },
    ];
  const txFilter: Record<string, unknown> = {
    branchId: ctx.branchId,
    ...ownFilter(ctx),
    ...(!has(ctx.actor, 'transactions.read.own')
      ? { _id: { $exists: false } }
      : {}),
  };
  if (query.currency) txFilter.currency = query.currency;
  if (query.type) txFilter.type = query.type;
  if (query.status) txFilter.status = query.status;
  const range = dateRange(query);
  if (range) txFilter.orderAt = range;
  if (query.outstanding === 'true')
    txFilter.$expr = {
      $and: [
        { $ne: ['$status', 'cancelled'] },
        { $gt: ['$totalMinor', '$paidMinor'] },
      ],
    };
  if (query.upcoming === 'true') {
    txFilter.status = { $in: ['pending', 'ready'] };
    txFilter.reservationAt = {
      $gte: new Date(calendarDay(new Date()) * 86400000 - 16200000),
      $lt: new Date((calendarDay(new Date()) + 7) * 86400000 - 16200000),
    };
  }
  const pipeline: PipelineStage[] = [
    { $match: filter },
    {
      $lookup: {
        from: 'transactions',
        let: { customer: '$_id' },
        pipeline: [
          {
            $match: {
              ...txFilter,
              $expr: {
                $and: [
                  { $eq: ['$customerId', '$$customer'] },
                  ...(query.outstanding === 'true'
                    ? [
                        { $ne: ['$status', 'cancelled'] },
                        { $gt: ['$totalMinor', '$paidMinor'] },
                      ]
                    : []),
                ],
              },
            },
          },
          { $sort: { createdAt: -1, _id: 1 } },
        ],
        as: 'history',
      },
    },
  ];
  if (
    query.currency ||
    query.type ||
    query.status ||
    range ||
    query.outstanding === 'true' ||
    query.upcoming === 'true'
  )
    pipeline.push({ $match: { 'history.0': { $exists: true } } });
  pipeline.push(
    {
      $set: {
        latestTransaction: { $arrayElemAt: ['$history', 0] },
        balances: {
          $map: {
            input: ['AFN', 'USD'],
            as: 'currency',
            in: {
              currency: '$$currency',
              totalMinor: {
                $toString: {
                  $sum: {
                    $map: {
                      input: '$history',
                      as: 'item',
                      in: {
                        $cond: [
                          {
                            $and: [
                              { $ne: ['$$item.status', 'cancelled'] },
                              { $eq: ['$$item.currency', '$$currency'] },
                            ],
                          },
                          { $toDecimal: '$$item.totalMinor' },
                          { $toDecimal: 0 },
                        ],
                      },
                    },
                  },
                },
              },
              outstandingMinor: {
                $toString: {
                  $sum: {
                    $map: {
                      input: '$history',
                      as: 'item',
                      in: {
                        $cond: [
                          {
                            $and: [
                              { $ne: ['$$item.status', 'cancelled'] },
                              { $eq: ['$$item.currency', '$$currency'] },
                            ],
                          },
                          {
                            $subtract: [
                              { $toDecimal: '$$item.totalMinor' },
                              { $toDecimal: '$$item.paidMinor' },
                            ],
                          },
                          { $toDecimal: 0 },
                        ],
                      },
                    },
                  },
                },
              },
              paidMinor: {
                $toString: {
                  $sum: {
                    $map: {
                      input: '$history',
                      as: 'item',
                      in: {
                        $cond: [
                          {
                            $and: [
                              { $ne: ['$$item.status', 'cancelled'] },
                              { $eq: ['$$item.currency', '$$currency'] },
                            ],
                          },
                          { $toDecimal: '$$item.paidMinor' },
                          { $toDecimal: 0 },
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
        },
        transactionCount: { $size: '$history' },
      },
    },
    { $unset: ['history', 'normalizedName'] },
    { $sort: { [query.sort]: query.direction === 'asc' ? 1 : -1, _id: 1 } },
    {
      $facet: {
        items: [
          { $skip: (query.page - 1) * query.limit },
          { $limit: query.limit },
        ],
        count: [{ $count: 'total' }],
      },
    },
  );
  const [result] = await Customer.aggregate<{
    items: {
      balances: { currency: string; totalMinor: string; paidMinor: string }[];
    }[];
    count: { total: number }[];
  }>(pipeline);
  return present(
    {
      items: (result?.items || []).map((item) => {
        const currency = query.currency || branchCurrency(ctx.branchId);
        const account = item.balances.find(
          (account) => account.currency === currency,
        );
        return {
          ...item,
          currency,
          totalMinor: account?.totalMinor || '0',
          paidMinor: account?.paidMinor || '0',
        };
      }),
      total: result?.count[0]?.total || 0,
      page: query.page,
      limit: query.limit,
    },
    ctx,
  );
}
export async function customerDetail(ctx: Context, id: string) {
  requirePermission(ctx.actor, 'customers.read');
  const customer = found(
    await Customer.findOne({ _id: id, branchId: ctx.branchId }).lean(),
  );
  const balances = has(ctx.actor, 'transactions.read.own')
    ? await Transaction.aggregate([
        {
          $match: {
            customerId: id,
            branchId: ctx.branchId,
            ...ownFilter(ctx),
            status: { $ne: 'cancelled' },
          },
        },
        {
          $group: {
            _id: '$currency',
            totalMinor: { $sum: { $toDecimal: '$totalMinor' } },
            paidMinor: { $sum: { $toDecimal: '$paidMinor' } },
          },
        },
        {
          $project: {
            _id: 0,
            currency: '$_id',
            totalMinor: { $toString: '$totalMinor' },
            paidMinor: { $toString: '$paidMinor' },
            outstandingMinor: {
              $toString: { $subtract: ['$totalMinor', '$paidMinor'] },
            },
          },
        },
      ])
    : [];
  return present({ ...customer, balances }, ctx);
}
export function transactionFilter(
  ctx: Context,
  query: ListQuery,
): FilterQuery<TransactionRecord> {
  if (!has(ctx.actor, 'transactions.read.all'))
    requirePermission(ctx.actor, 'transactions.read.own');
  const filter: FilterQuery<TransactionRecord> = {
    branchId: ctx.branchId,
    ...ownFilter(ctx),
  };
  if (query.currency) filter.currency = query.currency;
  if (query.customerId) filter.customerId = query.customerId;
  if (query.status) filter.status = query.status;
  if (query.type) filter.type = query.type;
  if (query.q)
    filter.$or = [
      { customerName: { $regex: `^${escaped(query.q)}`, $options: 'i' } },
      { code: { $regex: `^${escaped(query.q.toUpperCase())}` } },
      { 'product.name': { $regex: `^${escaped(query.q)}`, $options: 'i' } },
    ];
  const range = dateRange(query);
  if (range) filter.orderAt = range;
  if (query.outstanding === 'true')
    filter.$expr = {
      $and: [
        { $ne: ['$status', 'cancelled'] },
        { $gt: ['$totalMinor', '$paidMinor'] },
      ],
    };
  if (query.upcoming === 'true') {
    filter.status = { $in: ['pending', 'ready'] };
    filter.reservationAt = {
      $gte: new Date(calendarDay(new Date()) * 86400000 - 16200000),
      $lt: new Date((calendarDay(new Date()) + 7) * 86400000 - 16200000),
    };
  }
  return filter;
}
export async function transactionList(ctx: Context, query: ListQuery) {
  return present(
    await paged(Transaction, transactionFilter(ctx, query), query),
    ctx,
  );
}
export async function transactionDetail(ctx: Context, id: string) {
  if (!has(ctx.actor, 'transactions.read.all'))
    requirePermission(ctx.actor, 'transactions.read.own');
  const transaction = found(
    await Transaction.findOne({
      _id: id,
      branchId: ctx.branchId,
      ...ownFilter(ctx),
    }).lean(),
  );
  const payments = await Payment.find({
    branchId: ctx.branchId,
    transactionId: id,
  })
    .sort({ createdAt: 1, _id: 1 })
    .lean();
  const invoices = has(ctx.actor, 'invoices.read')
    ? await Invoice.find({ branchId: ctx.branchId, transactionId: id })
        .select('_id code createdAt transactionVersion')
        .sort({ createdAt: -1 })
        .lean()
    : [];
  return present({ ...transaction, payments, invoices }, ctx);
}
export async function invoiceDetail(ctx: Context, id: string) {
  requirePermission(ctx.actor, 'invoices.read');
  const invoice = found(
    await Invoice.findOne({ _id: id, branchId: ctx.branchId }).lean(),
  );
  found(
    await Transaction.exists({
      _id: invoice.transactionId,
      branchId: ctx.branchId,
      ...ownFilter(ctx),
    }),
  );
  return present(invoice, ctx);
}
export async function resourceList(
  ctx: Context,
  resource: string,
  query: ListQuery,
) {
  switch (resource) {
    case 'products':
    case 'product-categories':
    case 'guarantees':
    case 'package-items':
      return catalogList(ctx, resource, query);
    case 'customers':
      return customerList(ctx, query);
    case 'transactions':
      return transactionList(ctx, query);
    case 'payments': {
      requirePermission(ctx.actor, 'transactions.read.own');
      if (!query.transactionId)
        throw new HttpError(400, 'transaction_required');
      found(
        await Transaction.exists({
          _id: query.transactionId,
          branchId: ctx.branchId,
          ...ownFilter(ctx),
        }),
      );
      return present(
        await paged(
          Payment,
          { branchId: ctx.branchId, transactionId: query.transactionId },
          query,
        ),
        ctx,
      );
    }
    case 'invoices': {
      requirePermission(ctx.actor, 'invoices.read');
      if (!query.transactionId)
        throw new HttpError(400, 'transaction_required');
      found(
        await Transaction.exists({
          _id: query.transactionId,
          branchId: ctx.branchId,
          ...ownFilter(ctx),
        }),
      );
      return present(
        await paged(
          Invoice,
          { branchId: ctx.branchId, transactionId: query.transactionId },
          query,
        ),
        ctx,
      );
    }
    case 'notifications': {
      requirePermission(ctx.actor, 'notifications.read');
      const filter = {
        branchId: ctx.branchId,
        resolved: false,
        ...notificationAudience(ctx.actor),
        ...(query.unread === 'true'
          ? { readBy: { $ne: ctx.actor.subject } }
          : {}),
      };
      const result = await paged(Notification, filter, query);
      return present(
        {
          ...result,
          items: await enrichNotifications(result.items, ctx.actor),
        },
        ctx,
      );
    }
    case 'audit-logs': {
      requirePermission(ctx.actor, 'audit.read');
      if (!query.customerId)
        return paged(AuditLog, { branchId: ctx.branchId }, query);
      found(
        await Customer.exists({
          _id: query.customerId,
          branchId: ctx.branchId,
        }),
      );
      const transactions = await Transaction.find({
        customerId: query.customerId,
        branchId: ctx.branchId,
        ...ownFilter(ctx),
      })
        .select('_id')
        .lean();
      const ids = transactions.map((record) => record._id);
      const payments = await Payment.find({
        branchId: ctx.branchId,
        transactionId: { $in: ids },
      })
        .select('_id')
        .lean();
      return paged(
        AuditLog,
        {
          branchId: ctx.branchId,
          recordId: {
            $in: [
              query.customerId,
              ...ids,
              ...payments.map((record) => record._id),
            ],
          },
        },
        query,
      );
    }
    case 'devices':
      return paged(
        Device,
        { branchId: ctx.branchId, ownerId: ctx.actor.subject },
        query,
      );
    default:
      throw new HttpError(404, 'not_found');
  }
}
export async function settingsRead(ctx: Context) {
  requirePermission(ctx.actor, 'catalog.read');
  const settings = found(
    await BranchSettings.findOne({ branchId: ctx.branchId }).lean(),
  );
  const branch = found(await Branch.findById(ctx.branchId).lean());
  return { ...settings, branchName: branch.name };
}
export async function usersRead(ctx: Context) {
  requirePermission(ctx.actor, 'users.manage');
  return User.find({
    ...(ctx.actor.role === 'manager' ? { role: 'employee' } : {}),
    branchIds: { $not: { $elemMatch: { $nin: ctx.actor.branchIds } } },
  })
    .select('_id name role branchIds allow deny disabled language grantVersion')
    .limit(100)
    .lean();
}
