import mongoose, { Schema, type Model } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { branches, permissions, type Role, type Permission } from '@myt/shared';

export interface BaseRecord {
  _id: string;
  branchId: string;
  code: string;
  version: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
const base = {
  _id: { type: String, default: () => randomUUID() },
  branchId: {
    type: String,
    required: true,
    immutable: true,
    enum: branches.filter((b) => b.active).map((b) => b.id),
  },
  code: { type: String, required: true, immutable: true },
  version: { type: Number, required: true, default: 1 },
  createdBy: { type: String, required: true, immutable: true },
};
const options = {
  timestamps: true,
  strict: 'throw',
  versionKey: false,
} as const;
function register<T extends BaseRecord>(
  name: string,
  schema: Schema<T>,
  collection: string,
): Model<T> {
  schema.index({ branchId: 1, code: 1 }, { unique: true });
  schema.index({ branchId: 1, updatedAt: 1, _id: 1 });
  return mongoose.model<T>(name, schema, collection);
}
const minor = {
  type: Number,
  required: true,
  validate: Number.isSafeInteger,
  min: 0,
  max: 1_000_000_000_000,
};
export interface ExpenseRecord extends BaseRecord {
  name: string;
  amountMinor: number;
  currency: 'AFN' | 'USD';
  expenseAt: Date;
  spentBy: string;
  description: string;
}
const expenseSchema = new Schema<ExpenseRecord>(
  {
    ...base,
    name: { type: String, required: true, maxlength: 160 },
    amountMinor: { ...minor, min: 1 },
    currency: { type: String, enum: ['AFN', 'USD'], required: true },
    expenseAt: { type: Date, required: true },
    spentBy: { type: String, required: true, maxlength: 160 },
    description: { type: String, maxlength: 2000, default: '' },
  },
  { ...options, autoCreate: false, autoIndex: false },
);
expenseSchema.index({ branchId: 1, expenseAt: -1, _id: 1 });
// Created only by the explicit additive expenses migration, not startup bootstrap.
export const Expense = register('Expense', expenseSchema, 'expenses');
export interface CatalogRecord extends BaseRecord {
  currency?: 'AFN' | 'USD';
  clothingId?: string;
  photoId?: string | null;
  name: string;
  normalizedName: string;
  productType: string;
  brand: string;
  color: string;
  priceMinor: number;
  quantity: number;
  description: string;
  status: 'active' | 'inactive';
  categoryId: string | null;
  guaranteeType: string;
}
function catalogModel(name: string, collection: string) {
  const schema = new Schema<CatalogRecord>(
    {
      ...base,
      clothingId: { type: String },
      photoId: { type: String, default: null },
      name: { type: String, required: true },
      normalizedName: { type: String, required: true },
      productType: String,
      brand: String,
      color: String,
      currency: { type: String, enum: ['AFN', 'USD'] },
      priceMinor: minor,
      quantity: { type: Number, min: 1, max: 10000 },
      description: String,
      status: { type: String, enum: ['active', 'inactive'] },
      categoryId: { type: String, default: null },
      guaranteeType: String,
    },
    options,
  );
  schema.index(
    { branchId: 1, normalizedName: 1, brand: 1, color: 1, productType: 1 },
    { unique: true },
  );
  schema.index({ branchId: 1, status: 1, productType: 1, brand: 1, color: 1 });
  return register(name, schema, collection);
}
export const catalogModels = {
  products: catalogModel('Product', 'products'),
  'product-categories': catalogModel('ProductCategory', 'productCategories'),
  guarantees: catalogModel('Guarantee', 'guarantees'),
  'package-items': catalogModel('PackageItem', 'packageItems'),
};
export interface CustomerRecord extends BaseRecord {
  address: string;
  fullName: string;
  normalizedName: string;
  whatsapp: string;
  telephone: string;
  secondaryPhone: string;
  notes: string;
}
const customerSchema = new Schema<CustomerRecord>(
  {
    ...base,
    address: { type: String, default: '', maxlength: 250 },
    fullName: { type: String, required: true },
    normalizedName: { type: String, required: true },
    whatsapp: String,
    telephone: { type: String, required: true },
    secondaryPhone: String,
    notes: String,
  },
  options,
);
customerSchema.index({ branchId: 1, normalizedName: 1 });
customerSchema.index({ branchId: 1, telephone: 1 });
export const Customer = register('Customer', customerSchema, 'customers');
export interface ProductSnapshot {
  clothingId?: string;
  photoId?: string | null;
  id: string;
  code: string;
  name: string;
  productType: string;
  brand: string;
  color: string;
  originalMinor: number;
  currency?: 'AFN' | 'USD';
}
export interface PackageSnapshot {
  id: string;
  code: string;
  name: string;
  color: string;
  priceMinor: number;
  quantity: number;
}
export interface GuaranteeSnapshot {
  typeId: string;
  name: string;
  type: string;
  details: string;
  receivedAt: Date;
  returnedAt: Date | null;
  status: 'received' | 'returned';
}
export interface TransactionRecord extends BaseRecord {
  discountMinor?: number;
  chargesMinor?: number;
  customerId: string;
  customerName: string;
  product: ProductSnapshot;
  packages: PackageSnapshot[];
  guarantee: GuaranteeSnapshot | null;
  type: 'purchase' | 'rental';
  agreedMinor: number;
  packageMinor: number;
  totalMinor: number;
  paidMinor: number;
  currency: 'AFN' | 'USD';
  orderAt: Date;
  reservationAt: Date;
  returnDueAt?: Date | null;
  status: 'pending' | 'ready' | 'delivered' | 'returned' | 'cancelled';
  deliveredAt: Date | null;
  deliveredBy: string | null;
  returnedAt: Date | null;
  notes: string;
  deliveryNotes: string;
}
const transactionSchema = new Schema<TransactionRecord>(
  {
    discountMinor: { ...minor, default: 0 },
    chargesMinor: { ...minor, default: 0 },
    ...base,
    customerId: { type: String, required: true, immutable: true },
    customerName: String,
    product: { type: Schema.Types.Mixed, required: true, immutable: true },
    packages: {
      type: [
        new Schema<PackageSnapshot>(
          {
            id: String,
            code: String,
            name: String,
            color: String,
            priceMinor: minor,
            quantity: { type: Number, required: true, min: 1, max: 1000 },
          },
          { _id: false, strict: 'throw' },
        ),
      ],
      immutable: true,
    },
    guarantee: { type: Schema.Types.Mixed, default: null },
    type: {
      type: String,
      required: true,
      enum: ['purchase', 'rental'],
      immutable: true,
    },
    agreedMinor: minor,
    packageMinor: { ...minor, immutable: true },
    totalMinor: minor,
    paidMinor: minor,
    currency: { type: String, enum: ['AFN', 'USD'], immutable: true },
    orderAt: { type: Date, required: true, immutable: true },
    reservationAt: { type: Date, required: true },
    returnDueAt: { type: Date, default: null, immutable: true },
    status: {
      type: String,
      enum: ['pending', 'ready', 'delivered', 'returned', 'cancelled'],
    },
    deliveredAt: { type: Date, default: null },
    deliveredBy: { type: String, default: null },
    returnedAt: { type: Date, default: null },
    notes: String,
    deliveryNotes: String,
  },
  options,
);
transactionSchema.index({ branchId: 1, customerId: 1, createdAt: -1 });
transactionSchema.index({ branchId: 1, status: 1, reservationAt: 1 });
transactionSchema.index({ branchId: 1, createdBy: 1, orderAt: -1 });
export const Transaction = register(
  'Transaction',
  transactionSchema,
  'transactions',
);
export interface PaymentRecord extends BaseRecord {
  currency?: 'AFN' | 'USD';
  reference?: string;
  transactionId: string;
  customerId: string;
  amountMinor: number;
  kind: 'payment' | 'reversal';
  origin: 'advance' | 'additional' | 'reversal';
  reversalOf: string | null;
  method: string;
  paymentAt: Date;
  notes: string;
  employeeName: string;
}
const paymentSchema = new Schema<PaymentRecord>(
  {
    currency: { type: String, enum: ['AFN', 'USD'], immutable: true },
    reference: { type: String, maxlength: 100, immutable: true },
    ...base,
    transactionId: { type: String, required: true, immutable: true },
    customerId: { type: String, required: true, immutable: true },
    amountMinor: {
      type: Number,
      required: true,
      validate: Number.isSafeInteger,
      immutable: true,
    },
    origin: {
      type: String,
      enum: ['advance', 'additional', 'reversal'],
      required: true,
      immutable: true,
    },
    kind: { type: String, enum: ['payment', 'reversal'], immutable: true },
    reversalOf: { type: String, default: null, immutable: true },
    method: { type: String, immutable: true },
    paymentAt: { type: Date, required: true, immutable: true },
    notes: { type: String, immutable: true },
    employeeName: { type: String, immutable: true },
  },
  options,
);
paymentSchema.index({ branchId: 1, transactionId: 1, createdAt: 1 });
paymentSchema.index(
  { branchId: 1, reversalOf: 1 },
  {
    unique: true,
    partialFilterExpression: { reversalOf: { $type: 'string' } },
  },
);
export const Payment = register('Payment', paymentSchema, 'payments');
export interface InvoiceRecord extends BaseRecord {
  transactionId: string;
  customerId: string;
  snapshot: Record<string, unknown>;
  issuedBy: string;
  transactionVersion: number;
}
const invoiceSchema = new Schema<InvoiceRecord>(
  {
    ...base,
    transactionId: { type: String, immutable: true },
    customerId: { type: String, immutable: true },
    snapshot: { type: Schema.Types.Mixed, required: true, immutable: true },
    issuedBy: { type: String, immutable: true },
    transactionVersion: { type: Number, immutable: true },
  },
  options,
);
invoiceSchema.index({ branchId: 1, transactionId: 1, createdAt: -1 });
export const Invoice = register('Invoice', invoiceSchema, 'invoices');
export interface SettingsRecord extends BaseRecord {
  currency: 'AFN' | 'USD';
  paymentMethods: string[];
  offlinePayments: boolean;
  offlinePaymentLimitMinor: number;
  companyName: string;
  address: string;
  telephone: string;
}
const settingsSchema = new Schema<SettingsRecord>(
  {
    ...base,
    currency: { type: String, enum: ['AFN', 'USD'] },
    paymentMethods: [String],
    offlinePayments: Boolean,
    offlinePaymentLimitMinor: minor,
    companyName: String,
    address: String,
    telephone: String,
  },
  options,
);
settingsSchema.index({ branchId: 1 }, { unique: true });
export const BranchSettings = register(
  'BranchSettings',
  settingsSchema,
  'branchSettings',
);
export interface NotificationRecord extends BaseRecord {
  transactionId: string;
  customerId: string;
  customerName: string;
  productName: string;
  transactionType: string;
  reservationAt: Date;
  type:
    'tomorrow' | 'overdue' | 'payment' | 'transaction' | 'sync' | 'alteration';
  alterationId?: string;
  garmentId?: string;
  managementOnly?: boolean;
  deliveryStatus?: 'available' | 'resolved';
  eventId?: string;
  ownerId: string;
  readBy: string[];
  resolved: boolean;
}
const notificationSchema = new Schema<NotificationRecord>(
  {
    ...base,
    transactionId: String,
    customerId: String,
    customerName: String,
    productName: String,
    transactionType: String,
    reservationAt: Date,
    type: {
      type: String,
      enum: [
        'tomorrow',
        'overdue',
        'payment',
        'transaction',
        'sync',
        'alteration',
      ],
    },
    alterationId: String,
    garmentId: String,
    managementOnly: Boolean,
    deliveryStatus: { type: String, enum: ['available', 'resolved'] },
    eventId: String,
    ownerId: String,
    readBy: [String],
    resolved: Boolean,
  },
  options,
);
notificationSchema.index(
  { branchId: 1, transactionId: 1, type: 1, reservationAt: 1 },
  {
    unique: true,
    name: 'notification_reminder_unique',
    partialFilterExpression: { type: { $in: ['tomorrow', 'overdue'] } },
  },
);
notificationSchema.index(
  { branchId: 1, eventId: 1 },
  { unique: true, partialFilterExpression: { eventId: { $type: 'string' } } },
);
notificationSchema.index({ branchId: 1, resolved: 1, reservationAt: 1 });
export const Notification = register(
  'Notification',
  notificationSchema,
  'notifications',
);
export interface AuditRecord extends BaseRecord {
  actorId: string;
  deviceId: string;
  action: string;
  resource: string;
  recordId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}
const auditSchema = new Schema<AuditRecord>(
  {
    ...base,
    actorId: { type: String, immutable: true },
    deviceId: { type: String, immutable: true },
    action: { type: String, immutable: true },
    resource: { type: String, immutable: true },
    recordId: { type: String, immutable: true },
    before: { type: Schema.Types.Mixed, immutable: true },
    after: { type: Schema.Types.Mixed, immutable: true },
  },
  options,
);
auditSchema.index({ branchId: 1, recordId: 1, createdAt: -1 });
export const AuditLog = register('AuditLog', auditSchema, 'auditLogs');
export interface OperationRecord extends BaseRecord {
  operationId: string;
  actorId: string;
  deviceId: string;
  requestHash: string;
  action: string;
  result: unknown;
}
const operationSchema = new Schema<OperationRecord>(
  {
    ...base,
    operationId: String,
    actorId: String,
    deviceId: String,
    requestHash: String,
    action: String,
    result: Schema.Types.Mixed,
  },
  options,
);
operationSchema.index(
  { branchId: 1, actorId: 1, operationId: 1 },
  { unique: true },
);
export const SyncOperation = register(
  'SyncOperation',
  operationSchema,
  'syncOperations',
);
export interface DeviceRecord extends BaseRecord {
  ownerId: string;
  deviceId: string;
  label: string;
  revoked: boolean;
  lastSeenAt: Date;
}
const deviceSchema = new Schema<DeviceRecord>(
  {
    ...base,
    ownerId: String,
    deviceId: String,
    label: String,
    revoked: Boolean,
    lastSeenAt: Date,
  },
  options,
);
deviceSchema.index({ branchId: 1, ownerId: 1, deviceId: 1 }, { unique: true });
export const Device = register('Device', deviceSchema, 'devices');
export interface UserRecord {
  _id: string;
  name: string;
  role: Role;
  branchIds: string[];
  allow: Permission[];
  deny: Permission[];
  disabled: boolean;
  language: 'en' | 'fa-AF' | 'ps-AF';
  grantVersion: number;
  normalizedEmail?: string;
  passwordHash?: string;
  accountStatus: 'active' | 'suspended' | 'deactivated';
  assignedBranchId: string | null;
  createdBy: string;
  updatedBy: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  failedLogins: number;
  lockedUntil?: Date;
}
export const User = mongoose.model<UserRecord>(
  'User',
  new Schema<UserRecord>(
    {
      _id: { type: String, required: true },
      name: String,
      role: { type: String, enum: ['admin', 'manager', 'employee'] },
      branchIds: [
        {
          type: String,
          enum: branches.filter((b) => b.active).map((b) => b.id),
        },
      ],
      allow: [{ type: String, enum: permissions }],
      deny: [{ type: String, enum: permissions }],
      disabled: Boolean,
      language: { type: String, enum: ['en', 'fa-AF', 'ps-AF'] },
      grantVersion: { type: Number, default: 1 },
      normalizedEmail: { type: String, select: false },
      passwordHash: { type: String, select: false },
      accountStatus: {
        type: String,
        enum: ['active', 'suspended', 'deactivated'],
        default: 'active',
      },
      assignedBranchId: { type: String, default: null },
      createdBy: String,
      updatedBy: String,
      lastLoginAt: Date,
      failedLogins: { type: Number, default: 0, select: false },
      lockedUntil: { type: Date, select: false },
    },
    { ...options, autoIndex: false },
  ),
  'users',
);
export const RoleModel = mongoose.model(
  'Role',
  new Schema({ _id: String, permissions: [String] }, { versionKey: false }),
  'roles',
);
export const PermissionModel = mongoose.model(
  'Permission',
  new Schema({ _id: String }, { versionKey: false }),
  'permissions',
);
export const Branch = mongoose.model(
  'Branch',
  new Schema(
    {
      _id: {
        type: String,
        enum: branches.filter((b) => b.active).map((b) => b.id),
      },
      name: String,
      active: { type: Boolean, default: true },
    },
    { versionKey: false },
  ),
  'branches',
);
export const allModels = [
  Customer,
  Transaction,
  Payment,
  Invoice,
  Notification,
  BranchSettings,
  AuditLog,
  SyncOperation,
  Device,
  User,
  RoleModel,
  PermissionModel,
  Branch,
  ...Object.values(catalogModels),
];
