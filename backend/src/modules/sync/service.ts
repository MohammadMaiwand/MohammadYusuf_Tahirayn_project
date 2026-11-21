import type { Model } from 'mongoose';
import { z } from 'zod';
import {
  catalogModels,
  Customer,
  Transaction,
  type BaseRecord,
} from '../../database/models.js';
import {
  ownFilter,
  requirePermission,
  type Context,
} from '../../security/identity.js';
import { present } from '../../services/queries.js';
const pullSchema = z.object({
  resource: z.enum([
    'products',
    'product-categories',
    'guarantees',
    'package-items',
    'customers',
    'transactions',
  ]),
  cursor: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(100),
});
const cursorSchema = z.object({
  date: z.iso.datetime(),
  id: z.string().max(100),
  until: z.iso.datetime(),
  resource: z.string(),
  branchId: z.string(),
  actorId: z.string(),
});
export async function pull(ctx: Context, input: unknown) {
  requirePermission(ctx.actor, 'sync.use');
  const query = pullSchema.parse(input);
  requirePermission(
    ctx.actor,
    query.resource === 'customers'
      ? 'customers.read'
      : query.resource === 'transactions'
        ? 'transactions.read.own'
        : 'catalog.read',
  );
  const cursor = query.cursor
    ? cursorSchema.parse(
        JSON.parse(Buffer.from(query.cursor, 'base64url').toString('utf8')),
      )
    : null;
  if (
    cursor &&
    (cursor.branchId !== ctx.branchId ||
      cursor.actorId !== ctx.actor.subject ||
      cursor.resource !== query.resource)
  )
    throw new Error('Invalid scoped cursor');
  const until = cursor?.until || new Date().toISOString();
  const model = (query.resource === 'customers'
    ? Customer
    : query.resource === 'transactions'
      ? Transaction
      : catalogModels[query.resource]) as unknown as Model<BaseRecord>;
  const filter = {
    branchId: ctx.branchId,
    ...(query.resource === 'transactions' ? ownFilter(ctx) : {}),
    updatedAt: { $lte: new Date(until) },
    ...(cursor
      ? {
          $or: [
            {
              updatedAt: { $gt: new Date(cursor.date), $lte: new Date(until) },
            },
            { updatedAt: new Date(cursor.date), _id: { $gt: cursor.id } },
          ],
        }
      : {}),
  };
  const items = await model
    .find(filter)
    .sort({ updatedAt: 1, _id: 1 })
    .limit(query.limit)
    .lean();
  const last = items.at(-1);
  const nextCursor =
    items.length === query.limit && last
      ? Buffer.from(
          JSON.stringify({
            date: last.updatedAt.toISOString(),
            id: last._id,
            until,
            resource: query.resource,
            branchId: ctx.branchId,
            actorId: ctx.actor.subject,
          }),
        ).toString('base64url')
      : null;
  return { items: present(items, ctx), nextCursor, until };
}
