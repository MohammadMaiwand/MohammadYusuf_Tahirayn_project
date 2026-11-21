import { z } from 'zod';
import { moneyToMinor } from '../utils/money.js';
export const uuid = z.uuid();
export const branchId = z.enum([
  'dollar',
  'sham-royal',
  'sham-aroos',
  'sham-aroos-vip',
]);
export const amount = z.string().refine((value) => {
  try {
    moneyToMinor(value);
    return true;
  } catch {
    return false;
  }
}, 'invalid_amount');
export const text = z.string().trim().min(1).max(160);
export const note = z.string().trim().max(2000).default('');
export const currency = z.enum(['AFN', 'USD']);
export const timestamp = z.iso.datetime({ offset: true });
export const expenseInput = z
  .object({
    id: uuid.optional(),
    currency: currency.optional(),
    name: text,
    amount: amount.pipe(
      z.string().refine((value) => moneyToMinor(value) > 0, 'invalid_amount'),
    ),
    expenseAt: timestamp,
    spentBy: text,
    description: note,
  })
  .strict();
export const catalogTypes = [
  'products',
  'product-categories',
  'guarantees',
  'package-items',
] as const;
export type CatalogType = (typeof catalogTypes)[number];
export const catalogInput = z
  .object({
    id: uuid.optional(),
    clothingId: z
      .string()
      .trim()
      .max(64)
      .regex(/^[\p{L}\p{N}-]*$/u)
      .optional(),
    photoId: uuid.nullable().optional(),
    name: text,
    productType: z.string().trim().max(100).default(''),
    brand: z.string().trim().max(100).default(''),
    color: z.string().trim().max(100).default(''),
    currency: currency.optional(),
    price: amount.default('0'),
    quantity: z.number().int().min(1).max(10000).default(1),
    description: note,
    status: z.enum(['active', 'inactive']).default('active'),
    categoryId: uuid.nullable().default(null),
    guaranteeType: z
      .enum(['tazkira', 'ring', 'necklace', 'cash', 'telephone', 'manual'])
      .default('manual'),
  })
  .strict();
export const customerInput = z
  .object({
    id: uuid.optional(),
    fullName: text,
    whatsapp: z.string().trim().max(30).default(''),
    telephone: z.string().trim().min(3).max(30),
    address: z.string().trim().max(250).default(''),
    secondaryPhone: z.string().trim().max(30).default(''),
    notes: note,
  })
  .strict();
export const guaranteeInput = z
  .object({
    typeId: uuid,
    details: z.string().trim().max(250).default(''),
    receivedAt: timestamp.optional(),
  })
  .strict();
export const transactionInput = z
  .object({
    id: uuid.optional(),
    currency: currency.optional(),
    customerId: uuid,
    productId: uuid,
    type: z.enum(['purchase', 'rental']),
    discount: amount.default('0'),
    charges: amount.default('0'),
    agreedPrice: amount,
    advance: amount.default('0'),
    paymentMethod: text.default('cash'),
    orderAt: timestamp.optional(),
    reservationAt: timestamp,
    returnDueAt: timestamp.nullable().optional(),
    packages: z
      .array(
        z
          .object({ itemId: uuid, quantity: z.number().int().min(1).max(1000) })
          .strict(),
      )
      .max(20)
      .default([]),
    guarantee: guaranteeInput.nullable().default(null),
    notes: note,
  })
  .strict();
export const registrationInput = z
  .object({
    customer: customerInput,
    transaction: transactionInput.omit({ customerId: true }),
  })
  .strict();
export const transactionEditInput = z
  .object({
    discount: amount.optional(),
    charges: amount.optional(),
    expectedVersion: z.number().int().min(1),
    agreedPrice: amount,
    reservationAt: timestamp,
    notes: note,
  })
  .strict();
export const paymentInput = z
  .object({
    id: uuid.optional(),
    currency: currency.optional(),
    transactionId: uuid,
    amount,
    method: text,
    paymentAt: timestamp.optional(),
    reference: z.string().trim().max(100).default(''),
    notes: note,
    expectedVersion: z.number().int().min(1),
  })
  .strict();
export const deliveryInput = z
  .object({
    expectedVersion: z.number().int().min(1),
    status: z.enum(['pending', 'ready', 'delivered', 'returned', 'cancelled']),
    notes: note,
    returnGuarantee: z.boolean().default(false),
  })
  .strict();
export const settingsInput = z
  .object({
    expectedVersion: z.number().int().min(1),
    currency: z.enum(['AFN', 'USD']),
    paymentMethods: z.array(text).min(1).max(12),
    offlinePayments: z.boolean(),
    offlinePaymentLimit: amount,
    branchName: text.optional(),
    companyName: text,
    address: z.string().max(250),
    telephone: z.string().max(50),
  })
  .strict();
export const advertisementInput = z
  .object({
    id: uuid.optional(),
    title: text,
    body: z.string().trim().max(2000).default(''),
    linkUrl: z.string().trim().max(500).default(''),
    linkLabel: z.string().trim().max(60).default(''),
    photoId: uuid.nullable().default(null),
    active: z.boolean().default(true),
    order: z.number().int().min(0).max(100000).default(0),
    startsAt: timestamp.nullable().default(null),
    endsAt: timestamp.nullable().default(null),
  })
  .strict();
export type AdvertisementInput = z.infer<typeof advertisementInput>;
export const commandSchema = z
  .object({
    operationId: uuid,
    deviceId: uuid,
    action: z.enum([
      'catalog.create',
      'catalog.update',
      'customer.register',
      'customer.create',
      'customer.update',
      'expense.create',
      'alteration.create',
      'alteration.update',
      'alteration.status',
      'transaction.update',
      'transaction.create',
      'payment.create',
      'payment.reverse',
      'delivery.update',
      'invoice.issue',
      'settings.update',
      'notification.read',
      'device.register',
      'user.grants',
      'preferences.update',
    ]),
    targetId: uuid.optional(),
    resource: z.enum(catalogTypes).optional(),
    expectedVersion: z.number().int().min(1).optional(),
    data: z.unknown(),
  })
  .strict();
export type Command = z.infer<typeof commandSchema>;
export type TransactionInput = z.infer<typeof transactionInput>;
