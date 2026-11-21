import { z } from 'zod';
import { amount, currency, note, text, timestamp, uuid } from './business.js';
export const alterationTypes = [
  'size',
  'waist',
  'sleeve',
  'length',
  'resizing',
  'style',
  'repair',
  'other',
] as const;
export const alterationStatuses = [
  'pending',
  'in_progress',
  'ready',
  'delivered',
  'cancelled',
  'overdue',
] as const;
export const calendarDay = (date: string | Date) =>
  Math.floor((new Date(date).getTime() + 16200000) / 86400000);
export const alterationDuration = (start: string | Date, end: string | Date) =>
  calendarDay(end) - calendarDay(start);
export const alterationInput = z
  .object({
    id: uuid.optional(),
    customerId: uuid,
    transactionId: uuid.nullable().default(null),
    garmentId: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[\p{L}\p{N}-]+$/u),
    garmentName: text,
    garmentType: text,
    brand: z.string().trim().max(100).default(''),
    color: z.string().trim().max(100).default(''),
    alterationType: z.enum(alterationTypes),
    description: z.string().trim().min(1).max(2000),
    originalCurrency: currency.optional(),
    originalPrice: amount,
    alterationPrice: amount,
    currency,
    tailorName: text,
    tailorId: uuid.nullable().default(null),
    startAt: timestamp,
    expectedAt: timestamp,
    photoId: uuid.nullable().default(null),
    notes: note,
  })
  .strict()
  .refine((value) => alterationDuration(value.startAt, value.expectedAt) >= 0, {
    message: 'invalid_alteration_dates',
    path: ['expectedAt'],
  });
export const alterationStatusInput = z
  .object({
    expectedVersion: z.number().int().min(1),
    status: z.enum([
      'pending',
      'in_progress',
      'ready',
      'delivered',
      'cancelled',
    ]),
  })
  .strict();
