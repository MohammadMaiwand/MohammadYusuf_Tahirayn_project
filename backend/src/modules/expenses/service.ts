import type { ClientSession } from 'mongoose';
import {
  expenseInput,
  moneyToMinor,
  branchCurrency,
  type Command,
} from '@myt/shared';
import { Expense } from '../../database/models.js';
import {
  context,
  requirePermission,
  type Context,
} from '../../security/identity.js';
import { base, audit } from '../../services/context.js';
import { escaped, type ListQuery } from '../../validators/query.js';

export async function createExpense(
  ctx: Context,
  command: Command,
  session: ClientSession,
) {
  context(ctx.actor, ctx.branchId);
  requirePermission(ctx.actor, 'expenses.create');
  const data = expenseInput.parse(command.data);
  const [record] = await Expense.create(
    [
      {
        ...base(ctx, 'EXP', data.id),
        name: data.name,
        amountMinor: moneyToMinor(data.amount),
        currency: data.currency || branchCurrency(ctx.branchId),
        expenseAt: new Date(data.expenseAt),
        spentBy: data.spentBy,
        description: data.description,
      },
    ],
    { session },
  );
  await audit(
    ctx,
    session,
    command.deviceId,
    'expense.create',
    'expenses',
    record!._id,
    null,
    {
      amountMinor: record!.amountMinor,
      currency: data.currency || branchCurrency(ctx.branchId),
    },
  );
  return record!.toObject();
}

export async function listExpenses(ctx: Context, query: ListQuery) {
  context(ctx.actor, ctx.branchId);
  requirePermission(ctx.actor, 'expenses.read');
  const filter = {
    branchId: ctx.branchId,
    ...(query.currency ? { currency: query.currency } : {}),
    ...(query.q
      ? {
          $or: ['name', 'code', 'spentBy'].map((field) => ({
            [field]: { $regex: escaped(query.q), $options: 'i' },
          })),
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    Expense.find(filter)
      .sort({ expenseAt: -1, _id: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Expense.countDocuments(filter),
  ]);
  return { items, total, page: query.page, limit: query.limit };
}
