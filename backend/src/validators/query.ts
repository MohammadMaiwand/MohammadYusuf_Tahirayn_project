import { z } from 'zod';
export const listQuery = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().trim().max(100).default(''),
  sort: z
    .enum([
      'createdAt',
      'updatedAt',
      'name',
      'fullName',
      'reservationAt',
      'orderAt',
      'totalMinor',
      'paidMinor',
    ])
    .default('createdAt'),
  direction: z.enum(['asc', 'desc']).default('desc'),
  currency: z.enum(['AFN', 'USD']).optional(),
  status: z.string().max(30).optional(),
  type: z.enum(['purchase', 'rental']).optional(),
  brand: z.string().max(100).optional(),
  color: z.string().max(100).optional(),
  productType: z.string().max(100).optional(),
  customerId: z.uuid().optional(),
  transactionId: z.uuid().optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  outstanding: z.enum(['true', 'false']).optional(),
  unread: z.enum(['true', 'false']).optional(),
  upcoming: z.enum(['true', 'false']).optional(),
});
export type ListQuery = z.infer<typeof listQuery>;
export function escaped(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
export function dateRange(query: ListQuery) {
  return query.from || query.to
    ? {
        ...(query.from ? { $gte: new Date(query.from) } : {}),
        ...(query.to ? { $lt: new Date(query.to) } : {}),
      }
    : undefined;
}
