import mongoose, { Schema } from 'mongoose';
import { alterationStatuses, alterationTypes, branches } from '@myt/shared';
import type { BaseRecord } from '../../database/models.js';
export interface AlterationRecord extends BaseRecord {
  customerId: string;
  transactionId: string | null;
  customerName: string;
  customerCode: string;
  telephone: string;
  whatsapp: string;
  garmentId: string;
  garmentName: string;
  garmentType: string;
  brand: string;
  color: string;
  alterationType: (typeof alterationTypes)[number];
  description: string;
  originalCurrency: 'AFN' | 'USD';
  originalMinor: number;
  alterationMinor: number;
  currency: 'AFN' | 'USD';
  tailorName: string;
  tailorId: string | null;
  startAt: Date;
  expectedAt: Date;
  durationDays: number;
  photoId: string | null;
  notes: string;
  status: (typeof alterationStatuses)[number];
  overdueFrom?: string;
  deliveredAt: Date | null;
}
const money = {
  type: Number,
  required: true,
  min: 0,
  max: 1000000000000,
  validate: Number.isSafeInteger,
};
const schema = new Schema<AlterationRecord>(
  {
    _id: { type: String, required: true },
    branchId: {
      type: String,
      required: true,
      immutable: true,
      enum: branches.filter((b) => b.active).map((b) => b.id),
    },
    code: { type: String, required: true, immutable: true },
    version: { type: Number, required: true, default: 1 },
    createdBy: { type: String, required: true, immutable: true },
    customerId: { type: String, required: true, immutable: true },
    transactionId: { type: String, default: null },
    customerName: String,
    customerCode: String,
    telephone: String,
    whatsapp: String,
    garmentId: { type: String, required: true },
    garmentName: { type: String, required: true },
    garmentType: { type: String, required: true },
    brand: String,
    color: String,
    alterationType: { type: String, enum: alterationTypes, required: true },
    description: { type: String, maxlength: 2000 },
    originalCurrency: {
      type: String,
      enum: ['AFN', 'USD'],
      required: true,
      immutable: true,
    },
    originalMinor: { ...money, immutable: true },
    alterationMinor: money,
    currency: {
      type: String,
      enum: ['AFN', 'USD'],
      required: true,
      immutable: true,
    },
    tailorName: { type: String, required: true },
    tailorId: { type: String, default: null },
    startAt: { type: Date, required: true },
    expectedAt: { type: Date, required: true },
    durationDays: { type: Number, min: 0, required: true },
    photoId: { type: String, default: null },
    notes: { type: String, maxlength: 2000 },
    status: { type: String, enum: alterationStatuses, default: 'pending' },
    overdueFrom: String,
    deliveredAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    strict: 'throw',
    versionKey: false,
    autoCreate: false,
    autoIndex: false,
  },
);
schema.index({ branchId: 1, garmentId: 1 }, { unique: true });
schema.index({ branchId: 1, customerId: 1, createdAt: -1, _id: 1 });
schema.index({ branchId: 1, status: 1, expectedAt: 1 });
schema.index({ branchId: 1, createdBy: 1, createdAt: -1 });
export const Alteration = mongoose.model<AlterationRecord>(
  'Alteration',
  schema,
  'alterations',
);
