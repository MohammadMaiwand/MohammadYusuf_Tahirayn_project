import type { SessionIdentity, Permission } from '@myt/shared';
export type Identity = SessionIdentity;
export interface Entity {
  _id: string;
  branchId: string;
  code: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  provisional?: boolean;
}
export interface Catalog extends Entity {
  currency?: 'AFN' | 'USD';
  clothingId?: string;
  photoId?: string | null;
  name: string;
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
export interface Customer extends Entity {
  address?: string;
  balances?: {
    currency: string;
    totalMinor: string;
    paidMinor: string;
    outstandingMinor: string;
  }[];
  fullName: string;
  whatsapp: string;
  telephone: string;
  secondaryPhone: string;
  notes: string;
  latestTransaction?: Transaction;
  totalMinor?: number | string;
  paidMinor?: number | string;
  transactionCount?: number;
}
export interface Payment extends Entity {
  reference?: string;
  currency?: 'AFN' | 'USD';
  transactionId: string;
  customerId: string;
  amountMinor: number;
  kind: 'payment' | 'reversal';
  origin: 'advance' | 'additional' | 'reversal';
  reversalOf: string | null;
  method: string;
  paymentAt: string;
  employeeName: string;
  notes: string;
}
export interface Transaction extends Entity {
  discountMinor?: number;
  chargesMinor?: number;
  customerId: string;
  customerName: string;
  product: {
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
  };
  packages: {
    id: string;
    name: string;
    code: string;
    color: string;
    priceMinor: number;
    quantity: number;
  }[];
  guarantee: {
    typeId: string;
    name: string;
    type: string;
    details: string;
    status: string;
    receivedAt: string;
    returnedAt: string | null;
  } | null;
  type: 'purchase' | 'rental';
  agreedMinor: number;
  packageMinor: number;
  totalMinor: number;
  paidMinor: number;
  currency: 'AFN' | 'USD';
  orderAt: string;
  reservationAt: string;
  returnDueAt?: string | null;
  status: 'pending' | 'ready' | 'delivered' | 'returned' | 'cancelled';
  notes: string;
  deliveryNotes: string;
  deliveredAt: string | null;
  deliveredBy: string | null;
  returnedAt: string | null;
  payments?: Payment[];
  invoices?: Invoice[];
}
export interface Settings extends Entity {
  branchName?: string;
  currency: 'AFN' | 'USD';
  paymentMethods: string[];
  offlinePayments: boolean;
  offlinePaymentLimitMinor: number;
  companyName: string;
  address: string;
  telephone: string;
}
export interface Invoice extends Entity {
  transactionId: string;
  customerId: string;
  issuedBy: string;
  transactionVersion: number;
  snapshot: {
    transaction: Transaction;
    customer: Customer;
    payments: Payment[];
    settings: Settings;
    employeeName: string;
  };
}
export interface Notification extends Entity {
  amountMinor?: string | number;
  alterationId?: string;
  currency?: 'AFN' | 'USD';
  garmentId?: string;
  managementOnly?: boolean;
  deliveryStatus?: string;
  transactionId: string;
  customerId: string;
  customerName: string;
  productName: string;
  transactionType: string;
  reservationAt: string;
  type: string;
  readBy: string[];
  resolved: boolean;
}
export interface UserGrant {
  _id: string;
  name: string;
  role: 'admin' | 'manager' | 'employee';
  branchIds: string[];
  allow: Permission[];
  deny: Permission[];
  disabled: boolean;
  grantVersion: number;
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  offline?: boolean;
}
export interface Report {
  currencyReports?: Report[];
  alterationChargesMinor?: string | number;
  expensesMinor?: number | string;
  currency?: 'AFN' | 'USD';
  totals: {
    count: number;
    purchases: number;
    rentals: number;
    agreedMinor: number | string;
    paidMinor: number | string;
    outstandingMinor: number | string;
  };
  customers: number;
  products: number;
  newCustomers: number;
  upcomingCount: number;
  overdueCount: number;
  recentCustomers: { _id: string; fullName: string; createdAt: string }[];
  collectedMinor: number | string;
  byDay: { _id: string; amountMinor: number | string; count: number }[];
  popularity: { _id: string; name: string; count: number }[];
  recent: Transaction[];
  deliveries: Transaction[];
  activities: {
    _id: string;
    action: string;
    resource: string;
    recordId: string;
    createdAt: string;
    actorId: string;
  }[];
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
export interface CompanyReport {
  generatedAt: string;
  branches: { branchId: string; name: string }[];
  comparison: CompanyComparisonRow[];
  summary: CompanySummary[];
}

export interface Alteration extends Entity {
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
  alterationType: (typeof import('@myt/shared').alterationTypes)[number];
  description: string;
  originalCurrency: 'AFN' | 'USD';
  originalMinor?: number;
  alterationMinor?: number;
  currency: 'AFN' | 'USD';
  tailorName: string;
  tailorId: string | null;
  startAt: string;
  expectedAt: string;
  durationDays: number;
  photoId: string | null;
  notes: string;
  status:
    'pending' | 'in_progress' | 'ready' | 'delivered' | 'cancelled' | 'overdue';
  deliveredAt: string | null;
  company?: { companyName: string; address: string; telephone: string };
}
