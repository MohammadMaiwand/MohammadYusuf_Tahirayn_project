import { Alteration } from '../alterations/model.js';
import { branches } from '@myt/shared';
import {
  Transaction,
  Expense,
  Customer,
  Payment,
  catalogModels,
  AuditLog,
  BranchSettings,
  Branch,
} from '../../database/models.js';
import {
  has,
  requirePermission,
  ownFilter,
  context,
  type Actor,
  type Context,
} from '../../security/identity.js';
import { kabulDay } from '../../jobs/notifications.js';
import { transactionFilter } from '../../services/queries.js';
import { dateRange, type ListQuery } from '../../validators/query.js';
// Currency-independent data is fetched once per report and shared across the
// AFN/USD passes, instead of running the same aggregations twice.
async function reportShared(
  ctx: Context,
  query: ListQuery,
  dashboard: boolean,
) {
  requirePermission(ctx.actor, dashboard ? 'dashboard.read' : 'reports.read');
  const range = dateRange(query);
  const today = new Date(kabulDay(new Date()) * 86400000 - 270 * 60000);
  const [
    customers,
    products,
    newCustomers,
    deliveries,
    activities,
    upcomingCount,
    overdueCount,
    recentCustomers,
    settings,
  ] = await Promise.all([
    Customer.countDocuments({ branchId: ctx.branchId }),
    catalogModels.products.countDocuments({
      branchId: ctx.branchId,
      status: 'active',
    }),
    Customer.countDocuments({
      branchId: ctx.branchId,
      createdAt: range || { $gte: new Date(Date.now() - 30 * 86400000) },
    }),
    Transaction.find({
      branchId: ctx.branchId,
      ...ownFilter(ctx),
      status: { $in: ['pending', 'ready'] },
      reservationAt: { $lt: new Date(Date.now() + 7 * 86400000) },
    })
      .select('code customerName product type reservationAt status customerId')
      .sort({ reservationAt: 1 })
      .limit(20)
      .lean(),
    AuditLog.find({
      branchId: ctx.branchId,
      ...(!has(ctx.actor, 'audit.read') ? { actorId: ctx.actor.subject } : {}),
    })
      .select('action resource recordId createdAt actorId')
      .sort({ createdAt: -1 })
      .limit(8)
      .lean(),
    Transaction.countDocuments({
      branchId: ctx.branchId,
      ...ownFilter(ctx),
      status: { $in: ['pending', 'ready'] },
      reservationAt: {
        $gte: today,
        $lt: new Date(today.getTime() + 7 * 86400000),
      },
    }),
    Transaction.countDocuments({
      branchId: ctx.branchId,
      ...ownFilter(ctx),
      status: { $in: ['pending', 'ready'] },
      reservationAt: { $lt: today },
    }),
    has(ctx.actor, 'customers.read')
      ? Customer.find({ branchId: ctx.branchId })
          .select('_id fullName createdAt')
          .sort({ createdAt: -1 })
          .limit(8)
          .lean()
      : Promise.resolve([]),
    BranchSettings.findOne({ branchId: ctx.branchId }).lean(),
  ]);
  return {
    customers,
    products,
    newCustomers,
    deliveries,
    activities,
    upcomingCount,
    overdueCount,
    recentCustomers,
    settings,
  };
}
type ReportShared = Awaited<ReturnType<typeof reportShared>>;
async function reportCurrency(
  ctx: Context,
  query: ListQuery,
  shared: ReportShared,
) {
  const match = {
    ...transactionFilter(ctx, query),
    currency: query.currency,
    $and: [{ status: { $ne: 'cancelled' } }],
  };
  const range = dateRange(query);
  const paymentFilter = {
    branchId: ctx.branchId,
    currency: query.currency,
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(!has(ctx.actor, 'transactions.read.all')
      ? { createdBy: ctx.actor.subject }
      : {}),
    ...(range ? { paymentAt: range } : {}),
  };
  const [totals, byDay, popularity, recent] = await Promise.all([
    Transaction.aggregate<{
      count: number;
      purchases: number;
      rentals: number;
      agreedMinor: { toString(): string };
      paidMinor: { toString(): string };
      outstandingMinor: { toString(): string };
    }>([
      { $match: match },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          purchases: {
            $sum: { $cond: [{ $eq: ['$type', 'purchase'] }, 1, 0] },
          },
          rentals: { $sum: { $cond: [{ $eq: ['$type', 'rental'] }, 1, 0] } },
          agreedMinor: { $sum: { $toDecimal: '$totalMinor' } },
          paidMinor: { $sum: { $toDecimal: '$paidMinor' } },
          outstandingMinor: {
            $sum: {
              $toDecimal: {
                $max: [0, { $subtract: ['$totalMinor', '$paidMinor'] }],
              },
            },
          },
        },
      },
    ]),
    Payment.aggregate<{
      _id: string;
      amountMinor: { toString(): string };
      count: number;
    }>([
      { $match: paymentFilter },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$paymentAt',
              timezone: 'Asia/Kabul',
            },
          },
          amountMinor: { $sum: { $toDecimal: '$amountMinor' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Transaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$product.id',
          name: { $first: '$product.name' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    Transaction.find(match)
      .select(
        'code customerName product type totalMinor paidMinor currency orderAt reservationAt status',
      )
      .sort({ createdAt: -1 })
      .limit(8)
      .lean(),
  ]);
  const expenseTotals = has(ctx.actor, 'expenses.read')
    ? await Expense.aggregate<{ amountMinor: { toString(): string } }>([
        {
          $match: {
            branchId: ctx.branchId,
            currency: query.currency,
            ...(range ? { expenseAt: range } : {}),
          },
        },
        {
          $group: {
            _id: null,
            amountMinor: { $sum: { $toDecimal: '$amountMinor' } },
          },
        },
      ])
    : [];
  const alterationCharges =
    has(ctx.actor, 'alterations.financial') &&
    has(ctx.actor, 'alterations.read')
      ? await Alteration.aggregate<{ amount: { toString(): string } }>([
          {
            $match: {
              branchId: ctx.branchId,
              currency: query.currency,
              status: { $ne: 'cancelled' },
              ...(!has(ctx.actor, 'alterations.read.all')
                ? { createdBy: ctx.actor.subject }
                : {}),
              ...(range ? { startAt: range } : {}),
              ...(query.customerId ? { customerId: query.customerId } : {}),
            },
          },
          {
            $group: {
              _id: null,
              amount: { $sum: { $toDecimal: '$alterationMinor' } },
            },
          },
        ])
      : [];
  return {
    currency: query.currency || shared.settings?.currency || 'AFN',
    expensesMinor: expenseTotals[0]?.amountMinor.toString() || '0',
    alterationChargesMinor: alterationCharges[0]?.amount.toString() || '0',
    totals: totals[0]
      ? {
          ...totals[0],
          agreedMinor: totals[0].agreedMinor.toString(),
          paidMinor: totals[0].paidMinor.toString(),
          outstandingMinor: totals[0].outstandingMinor.toString(),
        }
      : {
          count: 0,
          purchases: 0,
          rentals: 0,
          agreedMinor: 0,
          paidMinor: 0,
          outstandingMinor: 0,
        },
    customers: shared.customers,
    products: shared.products,
    newCustomers: shared.newCustomers,
    upcomingCount: shared.upcomingCount,
    overdueCount: shared.overdueCount,
    recentCustomers: shared.recentCustomers,
    byDay: byDay.map((day) => ({
      ...day,
      amountMinor: day.amountMinor.toString(),
    })),
    popularity,
    recent,
    deliveries: shared.deliveries,
    activities: shared.activities,
    collectedMinor: byDay
      .reduce((sum, item) => sum + BigInt(item.amountMinor.toString()), 0n)
      .toString(),
  };
}
export async function report(
  ctx: Context,
  query: ListQuery,
  dashboard = false,
) {
  const shared = await reportShared(ctx, query, dashboard);
  const currencies = await Promise.all(
    (['AFN', 'USD'] as const).map((currency) =>
      reportCurrency(ctx, { ...query, currency }, shared),
    ),
  );
  const selected = currencies.find(
    (row) =>
      row.currency === (query.currency || shared.settings?.currency || 'AFN'),
  )!;
  const recent = [...currencies.flatMap((row) => row.recent)]
    .sort(
      (a, b) => new Date(b.orderAt).getTime() - new Date(a.orderAt).getTime(),
    )
    .slice(0, 8);
  return {
    ...selected,
    recent: query.currency ? selected.recent : recent,
    currencyReports: currencies,
  };
}
const cell = (value: unknown) =>
  `"${String(value ?? '')
    .replace(/"/g, '""')
    .replace(/^[=+\-@\t\r]/, "'$&")}"`;
const xml = (value: unknown) =>
  String(value ?? '').replace(
    /[<>&"']/g,
    (char) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&apos;',
      })[char]!,
  );
export async function exportReport(
  ctx: Context,
  query: ListQuery,
  format: 'csv' | 'excel',
) {
  requirePermission(ctx.actor, 'exports.read');
  requirePermission(ctx.actor, 'reports.read');
  const rows = await Transaction.find(transactionFilter(ctx, query))
    .sort({ orderAt: -1, _id: 1 })
    .limit(10001)
    .lean();
  if (rows.length > 10000) {
    const { HttpError } = await import('../../utils/errors.js');
    throw new HttpError(422, 'export_range_too_large');
  }
  const table: unknown[][] = [
    [
      'Transaction ID',
      'Customer',
      'Type',
      'Order UTC',
      'Reservation UTC',
      'Currency',
      'Total minor units',
      'Paid minor units',
      'Status',
    ],
    ...rows.map((row) => [
      row.code,
      row.customerName,
      row.type,
      row.orderAt.toISOString(),
      row.reservationAt.toISOString(),
      row.currency,
      row.totalMinor,
      row.paidMinor,
      row.status,
    ]),
  ];
  if (format === 'csv')
    return '\ufeff' + table.map((row) => row.map(cell).join(',')).join('\r\n');
  return `<?xml version="1.0" encoding="UTF-8"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Transactions"><Table>${table.map((row) => `<Row>${row.map((value) => `<Cell><Data ss:Type="${typeof value === 'number' ? 'Number' : 'String'}">${xml(value)}</Data></Cell>`).join('')}</Row>`).join('')}</Table></Worksheet></Workbook>`;
}
export interface CompanySummary {
  currency: 'AFN' | 'USD';
  customers: number;
  products: number;
  newCustomers: number;
  upcomingCount: number;
  overdueCount: number;
  collectedMinor: string;
  expensesMinor: string;
  alterationChargesMinor: string;
  totals: {
    count: number;
    purchases: number;
    rentals: number;
    agreedMinor: string;
    paidMinor: string;
    outstandingMinor: string;
  };
  byDay: { _id: string; amountMinor: string; count: number }[];
  status: { status: string; count: number }[];
  popularity: { _id: string; name: string; count: number }[];
}
export interface CompanyComparisonRow {
  branchId: string;
  branchName: string;
  currency: 'AFN' | 'USD';
  customers: number;
  newCustomers: number;
  products: number;
  transactions: number;
  purchases: number;
  rentals: number;
  agreedMinor: string;
  paidMinor: string;
  collectedMinor: string;
  outstandingMinor: string;
  upcomingCount: number;
  overdueCount: number;
  expensesMinor: string;
  alterationChargesMinor: string;
}
// Admin-only company report: every authorised branch compared side by side
// with one roll-up per currency. Aggregate figures only, produced through the
// same per-branch report used by the single-branch report screen.
export async function companyReport(actor: Actor, query: ListQuery) {
  if (actor.role !== 'admin') {
    const { HttpError } = await import('../../utils/errors.js');
    throw new HttpError(403, 'forbidden');
  }
  requirePermission(actor, 'reports.read');
  const activeIds = actor.branchIds.filter((id) =>
    branches.some((branch) => branch.active && branch.id === id),
  );
  const range = dateRange(query);
  const branchDocs = await Branch.find({ _id: { $in: activeIds } })
    .select('_id name')
    .lean();
  const nameOf = (id: string) =>
    branchDocs.find((doc) => doc._id === id)?.name || id;
  const perBranch: {
    branchId: string;
    branchName: string;
    report: Awaited<ReturnType<typeof report>>;
  }[] = [];
  for (const id of activeIds)
    perBranch.push({
      branchId: id,
      branchName: nameOf(id),
      report: await report(context(actor, id), query),
    });
  const currencies = ['AFN', 'USD'] as const;
  const comparison: CompanyComparisonRow[] = [];
  const summary: CompanySummary[] = [];
  for (const currency of currencies) {
    const accounts = perBranch.map((row) => ({
      branchId: row.branchId,
      branchName: row.branchName,
      account:
        row.report.currencyReports?.find(
          (entry) => entry.currency === currency,
        ) || row.report,
    }));
    const money = (
      pick: (account: (typeof accounts)[number]['account']) => string | number,
    ) => accounts.reduce((total, row) => total + BigInt(pick(row.account)), 0n);
    const tally = (
      pick: (account: (typeof accounts)[number]['account']) => number,
    ) => accounts.reduce((total, row) => total + pick(row.account), 0);
    const days = new Map<string, { amountMinor: bigint; count: number }>();
    for (const { account } of accounts)
      for (const day of account.byDay) {
        const previous = days.get(day._id) || { amountMinor: 0n, count: 0 };
        days.set(day._id, {
          amountMinor: previous.amountMinor + BigInt(day.amountMinor),
          count: previous.count + day.count,
        });
      }
    const [statusRows, popularity] = await Promise.all([
      Transaction.aggregate<{ _id: string; count: number }>([
        {
          $match: {
            branchId: { $in: activeIds },
            currency,
            ...(range ? { orderAt: range } : {}),
          },
        },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Transaction.aggregate<{ _id: string; name: string; count: number }>([
        {
          $match: {
            branchId: { $in: activeIds },
            currency,
            status: { $ne: 'cancelled' },
            ...(range ? { orderAt: range } : {}),
          },
        },
        {
          $group: {
            _id: '$product.id',
            name: { $first: '$product.name' },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
    ]);
    for (const row of accounts)
      comparison.push({
        branchId: row.branchId,
        branchName: row.branchName,
        currency,
        customers: row.account.customers,
        newCustomers: row.account.newCustomers,
        products: row.account.products,
        transactions: row.account.totals.count,
        purchases: row.account.totals.purchases,
        rentals: row.account.totals.rentals,
        agreedMinor: String(row.account.totals.agreedMinor),
        paidMinor: String(row.account.totals.paidMinor),
        collectedMinor: String(row.account.collectedMinor),
        outstandingMinor: String(row.account.totals.outstandingMinor),
        upcomingCount: row.account.upcomingCount,
        overdueCount: row.account.overdueCount,
        expensesMinor: String(row.account.expensesMinor || 0),
        alterationChargesMinor: String(row.account.alterationChargesMinor || 0),
      });
    summary.push({
      currency,
      customers: tally((account) => account.customers),
      products: tally((account) => account.products),
      newCustomers: tally((account) => account.newCustomers),
      upcomingCount: tally((account) => account.upcomingCount),
      overdueCount: tally((account) => account.overdueCount),
      collectedMinor: money((account) => account.collectedMinor).toString(),
      expensesMinor: money((account) => account.expensesMinor || 0).toString(),
      alterationChargesMinor: money(
        (account) => account.alterationChargesMinor || 0,
      ).toString(),
      totals: {
        count: tally((account) => account.totals.count),
        purchases: tally((account) => account.totals.purchases),
        rentals: tally((account) => account.totals.rentals),
        agreedMinor: money((account) => account.totals.agreedMinor).toString(),
        paidMinor: money((account) => account.totals.paidMinor).toString(),
        outstandingMinor: money(
          (account) => account.totals.outstandingMinor,
        ).toString(),
      },
      byDay: [...days]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([_id, day]) => ({
          _id,
          amountMinor: day.amountMinor.toString(),
          count: day.count,
        })),
      status: statusRows.map((row) => ({ status: row._id, count: row.count })),
      popularity,
    });
  }
  return {
    generatedAt: new Date().toISOString(),
    branches: perBranch.map((row) => ({
      branchId: row.branchId,
      name: row.branchName,
    })),
    comparison,
    summary,
  };
}
export async function exportCompanyReport(
  actor: Actor,
  query: ListQuery,
  format: 'csv' | 'excel',
) {
  requirePermission(actor, 'exports.read');
  const data = await companyReport(actor, query);
  const table: unknown[][] = [
    [
      'Branch',
      'Currency',
      'Customers',
      'New customers',
      'Active products',
      'Transactions',
      'Purchases',
      'Rentals',
      'Agreed minor units',
      'Collected minor units',
      'Outstanding minor units',
      'Upcoming deliveries',
      'Overdue',
      'Expenses minor units',
      'Alteration charges minor units',
    ],
    ...data.comparison.map((row) => [
      row.branchName,
      row.currency,
      row.customers,
      row.newCustomers,
      row.products,
      row.transactions,
      row.purchases,
      row.rentals,
      row.agreedMinor,
      row.collectedMinor,
      row.outstandingMinor,
      row.upcomingCount,
      row.overdueCount,
      row.expensesMinor,
      row.alterationChargesMinor,
    ]),
    ...data.summary.map((row) => [
      `TOTAL (${row.currency})`,
      row.currency,
      row.customers,
      row.newCustomers,
      row.products,
      row.totals.count,
      row.totals.purchases,
      row.totals.rentals,
      row.totals.agreedMinor,
      row.collectedMinor,
      row.totals.outstandingMinor,
      row.upcomingCount,
      row.overdueCount,
      row.expensesMinor,
      row.alterationChargesMinor,
    ]),
  ];
  if (format === 'csv')
    return '\ufeff' + table.map((row) => row.map(cell).join(',')).join('\r\n');
  return `<?xml version="1.0" encoding="UTF-8"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Company report"><Table>${table.map((row) => `<Row>${row.map((value) => `<Cell><Data ss:Type="${typeof value === 'number' ? 'Number' : 'String'}">${xml(value)}</Data></Cell>`).join('')}</Row>`).join('')}</Table></Worksheet></Workbook>`;
}
