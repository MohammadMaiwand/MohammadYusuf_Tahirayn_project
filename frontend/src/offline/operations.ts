import {
  commandSchema,
  registrationInput,
  moneyToMinor,
  finalTotal,
  type Command,
} from '@myt/shared';
import * as api from '../services/api';
import * as vault from './vault';
import type {
  Catalog,
  Customer,
  Entity,
  Identity,
  Payment,
  Settings,
  Transaction,
} from '../types/business';
import { env } from '../lib/env';
export type QueueStatus =
  'pending' | 'synchronizing' | 'synced' | 'failed' | 'conflict' | 'superseded';
export interface Queued {
  command: Command;
  branchId: string;
  scope: string;
  actorId: string;
  status: QueueStatus;
  createdAt: number;
  attempts: number;
  nextRetryAt: number;
  error: string;
  result?: unknown;
}
const devices = new Set<string>();
let syncing = false;
const changed = () => window.dispatchEvent(new Event('myt-sync-changed'));
export async function queue() {
  return (await vault.entries<Queued>(api.scope(), 'queue:'))
    .map((item) => item.value)
    .sort((a, b) => a.createdAt - b.createdAt);
}
export async function ensureDevice() {
  const id = api.scope();
  if (devices.has(id)) return;
  await api.request(`/branches/${api.branch()}/commands`, {
    method: 'POST',
    body: JSON.stringify({
      action: 'device.register',
      operationId: crypto.randomUUID(),
      deviceId: vault.deviceId(),
      data: { label: 'Browser device' },
    }),
  });
  devices.add(id);
}
async function saveResult(
  action: string,
  resource: string | undefined,
  result: unknown,
  destination = api.scope(),
) {
  if (!result || typeof result !== 'object') return;
  const record = result as Entity & {
    transaction?: Transaction;
    customer?: Customer;
    payment?: Payment;
  };
  if (record.customer)
    await api.cacheEntity('customers', record.customer, destination);
  if (record.transaction)
    await api.cacheEntity('transactions', record.transaction, destination);
  if (record.payment)
    await api.cacheEntity('payments', record.payment, destination);
  if (record._id)
    await api.cacheEntity(
      resource ||
        (action.startsWith('customer')
          ? 'customers'
          : action.startsWith('transaction') || action === 'delivery.update'
            ? 'transactions'
            : action.startsWith('invoice')
              ? 'invoices'
              : 'settings'),
      record,
      destination,
    );
}
async function provisional(
  command: Command,
  draftCustomer?: Customer,
): Promise<{
  resource: string;
  value: Entity | Record<string, unknown>;
  customer?: Customer;
}> {
  api.liveLease();
  if (!api.allowed('offline.write'))
    throw new api.ApiError(403, 'offline_action_denied');
  const data = command.data as Record<string, unknown>;
  const now = new Date().toISOString();
  const id = String(data.id || command.targetId || crypto.randomUUID());
  const base: Entity = {
    _id: id,
    branchId: api.branch(),
    code: `LOCAL-${id}`,
    version: 1,
    createdBy: api.session()!.subject,
    createdAt: now,
    updatedAt: now,
    provisional: true,
  };
  if (command.action === 'customer.register') {
    if (!api.allowed('customers.write'))
      throw new api.ApiError(403, 'forbidden');
    const parsed = registrationInput.parse(command.data);
    const customer = {
      ...base,
      ...parsed.customer,
      _id: parsed.customer.id!,
    } as Customer;
    const local = await provisional(
      {
        ...command,
        action: 'transaction.create',
        data: { ...parsed.transaction, customerId: customer._id },
      },
      customer,
    );
    return { ...local, customer };
  }
  if (command.action === 'customer.create')
    return { resource: 'customers', value: { ...base, ...data } };
  if (
    command.action === 'catalog.create' ||
    command.action === 'catalog.update'
  ) {
    if (
      !api.allowed(
        `${command.resource}.${command.action === 'catalog.create' ? 'create' : 'update'}`,
      )
    )
      throw new api.ApiError(403, 'forbidden');
    const previous =
      command.action === 'catalog.update'
        ? await api.cachedEntity<Catalog>(command.resource!, id)
        : undefined;
    if (command.action === 'catalog.update' && !previous)
      throw new api.ApiError(503, 'not_cached');
    return {
      resource: command.resource!,
      value: {
        ...base,
        ...previous,
        ...data,
        priceMinor: moneyToMinor(String(data.price)),
        version: previous ? previous.version + 1 : 1,
        provisional: true,
      },
    };
  }
  if (command.action === 'customer.update') {
    const previous = await api.cachedEntity<Customer>('customers', id);
    if (!previous) throw new api.ApiError(503, 'not_cached');
    return {
      resource: 'customers',
      value: {
        ...previous,
        ...data,
        version: previous.version + 1,
        provisional: true,
      },
    };
  }
  const settings = await api.get<Settings>('/settings');
  if (command.action === 'transaction.create') {
    if (!api.allowed('transactions.create'))
      throw new api.ApiError(403, 'forbidden');
    const customer =
      draftCustomer ||
      (await api.cachedEntity<Customer>('customers', String(data.customerId)));
    const product = await api.cachedEntity<Catalog>(
      'products',
      String(data.productId),
    );
    if (!customer || !product) throw new api.ApiError(503, 'not_cached');
    const currency = (data.currency || settings.currency) as 'AFN' | 'USD';
    const packages = [];
    for (const selected of data.packages as {
      itemId: string;
      quantity: number;
    }[]) {
      const item = await api.cachedEntity<Catalog>(
        'package-items',
        selected.itemId,
      );
      if (!item) throw new api.ApiError(503, 'not_cached');
      if ((item.currency || settings.currency) !== currency)
        throw new api.ApiError(422, 'currency_mismatch');
      packages.push({
        id: item._id,
        code: item.code,
        name: item.name,
        color: item.color,
        priceMinor: item.priceMinor,
        quantity: selected.quantity,
      });
    }
    const agreedMinor = moneyToMinor(String(data.agreedPrice)),
      paidMinor = moneyToMinor(String(data.advance)),
      totalMinor = finalTotal(
        agreedMinor,
        packages,
        moneyToMinor(String(data.discount || '0')),
        moneyToMinor(String(data.charges || '0')),
      );
    if (totalMinor <= 0 || paidMinor > totalMinor)
      throw new api.ApiError(422, 'overpayment');
    if (
      paidMinor > 0 &&
      (!api.allowed('payments.create') ||
        !settings.offlinePayments ||
        currency !== settings.currency ||
        paidMinor > settings.offlinePaymentLimitMinor)
    )
      throw new api.ApiError(403, 'offline_payment_denied');
    const value = {
      ...base,
      customerId: customer._id,
      customerName: customer.fullName,
      product: {
        id: product._id,
        code: product.code,
        clothingId: product.clothingId,
        photoId: product.photoId,
        name: product.name,
        productType: product.productType,
        brand: product.brand,
        color: product.color,
        originalMinor: product.priceMinor,
        currency: product.currency || settings.currency,
      },
      packages,
      guarantee: null,
      type: data.type,
      agreedMinor,
      discountMinor: moneyToMinor(String(data.discount || '0')),
      chargesMinor: moneyToMinor(String(data.charges || '0')),
      packageMinor: finalTotal(0, packages),
      totalMinor,
      paidMinor,
      currency,
      orderAt: data.orderAt || now,
      reservationAt: data.reservationAt,
      returnDueAt: data.returnDueAt || null,
      status: 'pending',
      notes: data.notes,
      payments: [],
      invoices: [],
    };
    return { resource: 'transactions', value };
  }
  if (command.action === 'payment.create') {
    if (!api.allowed('payments.create'))
      throw new api.ApiError(403, 'forbidden');
    const transaction = await api.cachedEntity<Transaction>(
      'transactions',
      String(data.transactionId),
    );
    if (!transaction) throw new api.ApiError(503, 'not_cached');
    if (transaction.status === 'cancelled')
      throw new api.ApiError(422, 'transaction_cancelled');
    if (data.currency && data.currency !== transaction.currency)
      throw new api.ApiError(422, 'currency_mismatch');
    const amountMinor = moneyToMinor(String(data.amount));
    if (
      !settings.offlinePayments ||
      transaction.currency !== settings.currency ||
      amountMinor > settings.offlinePaymentLimitMinor
    )
      throw new api.ApiError(403, 'offline_payment_denied');
    if (
      amountMinor <= 0 ||
      transaction.paidMinor + amountMinor > transaction.totalMinor
    )
      throw new api.ApiError(422, 'overpayment');
    const payment = {
      ...base,
      transactionId: transaction._id,
      currency: transaction.currency,
      customerId: transaction.customerId,
      amountMinor,
      kind: 'payment',
      origin: 'additional',
      method: data.method,
      paymentAt: data.paymentAt || now,
      employeeName: api.session()!.name,
      notes: data.notes,
      reversalOf: null,
    } as Payment;
    const value = {
      ...transaction,
      paidMinor: transaction.paidMinor + amountMinor,
      version: transaction.version + 1,
      provisional: true,
      payments: [...(transaction.payments || []), payment],
    };
    return { resource: 'transactions', value };
  }
  throw new api.ApiError(403, 'offline_action_denied');
}
async function performMutation<T>(
  action: Command['action'],
  data: unknown,
  options: {
    operationId?: string;
    resource?: Command['resource'];
    targetId?: string;
    expectedVersion?: number;
  } = {},
): Promise<T> {
  const destination = api.scope(),
    selectedBranch = api.branch();
  const draft = { ...(data as Record<string, unknown>) };
  if (action.endsWith('.create') && !draft.id)
    draft.id = options.operationId || crypto.randomUUID();
  if (action === 'customer.register') {
    const transaction = draft.transaction as Record<string, unknown>;
    draft.transaction = {
      ...transaction,
      id: transaction.id || options.operationId || crypto.randomUUID(),
    };
  }
  const command = commandSchema.parse({
    action,
    data: draft,
    operationId: crypto.randomUUID(),
    deviceId: vault.deviceId(),
    ...options,
  });
  const pending = (await queue()).some(
    (item) => !['synced', 'superseded'].includes(item.status),
  );
  if (!pending) {
    try {
      if (!navigator.onLine) throw new TypeError('offline');
      await ensureDevice();
      const result = await api.request<T>(
        `/branches/${selectedBranch}/commands`,
        { method: 'POST', body: JSON.stringify(command) },
      );
      // The server has committed. A local cache failure must never turn this
      // success into a provisional command or invite another financial save.
      try {
        await saveResult(action, options.resource, result, destination);
      } catch {
        window.dispatchEvent(
          new CustomEvent('myt-toast', { detail: 'error.storage_unavailable' }),
        );
      }
      changed();
      return result;
    } catch (error) {
      if (error instanceof api.ApiError) throw error;
    }
  }
  if (env.VITE_OFFLINE_SYNC_ENABLED !== 'true')
    throw new api.ApiError(403, 'sync_disabled');
  if (api.scope() !== destination) throw new api.ApiError(403, 'branch_denied');
  const local = await provisional(command);
  if (api.scope() !== destination) throw new api.ApiError(403, 'branch_denied');
  const queued: Queued = {
    command,
    branchId: api.branch(),
    scope: api.scope(),
    actorId: api.session()!.subject,
    status: 'pending',
    createdAt: Date.now(),
    attempts: 0,
    nextRetryAt: 0,
    error: '',
  };
  await vault.putMany(api.scope(), [
    ...(local.customer !== undefined
      ? [
          {
            id: `entity:customers:${(local.customer as Customer)._id}`,
            value: local.customer,
          },
        ]
      : []),
    { id: `queue:${command.operationId}`, value: queued },
    {
      id: `entity:${local.resource}:${(local.value as Entity)._id}`,
      value: local.value,
    },
  ]);
  changed();
  if (navigator.onLine) void synchronize();
  return (
    action === 'customer.register' && local.customer !== undefined
      ? { customer: local.customer, transaction: local.value }
      : local.value
  ) as T;
}
export async function synchronize() {
  if (syncing || !navigator.onLine || env.VITE_OFFLINE_SYNC_ENABLED !== 'true')
    return;
  syncing = true;
  const originalScope = api.scope();
  try {
    const identity = await api.refreshIdentity();
    if (originalScope !== api.scope()) return;
    await ensureDevice();
    for (const item of await queue()) {
      if (api.scope() !== originalScope) return;
      if (['synced', 'superseded'].includes(item.status)) continue;
      if (
        ['conflict', 'failed'].includes(item.status) ||
        item.nextRetryAt > Date.now()
      )
        break;
      item.status = 'synchronizing';
      await vault.put(item.scope, `queue:${item.command.operationId}`, item);
      changed();
      try {
        const [response] = await api.request<
          {
            operationId: string;
            status: string;
            code?: string;
            result?: unknown;
          }[]
        >(`/branches/${item.branchId}/sync/push`, {
          method: 'POST',
          body: JSON.stringify({ operations: [item.command] }),
        });
        if (!response) throw new Error('sync_failed');
        item.status =
          response.status === 'synced'
            ? 'synced'
            : response.status === 'conflict'
              ? 'conflict'
              : 'failed';
        item.error = response.code || '';
        item.result = response.result;
        if (item.status === 'synced')
          await saveResult(
            item.command.action,
            item.command.resource,
            response.result,
            originalScope,
          );
      } catch (error) {
        item.attempts++;
        item.status = error instanceof api.ApiError ? 'failed' : 'pending';
        item.error =
          error instanceof api.ApiError ? error.code : 'network_unavailable';
        item.nextRetryAt =
          Date.now() + Math.min(60000, 1000 * 2 ** Math.min(item.attempts, 6));
      }
      await vault.put(item.scope, `queue:${item.command.operationId}`, item);
      changed();
      if (item.status !== 'synced') break;
    }
    if (
      (await queue()).some(
        (item) => !['synced', 'superseded'].includes(item.status),
      )
    )
      return;
    const resources = [
      'products',
      'product-categories',
      'guarantees',
      'package-items',
      'customers',
      'transactions',
    ].filter((resource) =>
      identity.permissions.includes(
        resource === 'customers'
          ? 'customers.read'
          : resource === 'transactions'
            ? 'transactions.read.own'
            : 'catalog.read',
      ),
    );
    for (const resource of resources) {
      let cursor: string | null = null;
      do {
        if (api.scope() !== originalScope) return;
        const response: { items: Entity[]; nextCursor: string | null } =
          await api.request(
            `/branches/${api.branch()}/sync/pull?resource=${resource}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
          );
        for (const record of response.items)
          await api.cacheEntity(resource, record, originalScope);
        cursor = response.nextCursor;
      } while (cursor);
    }
    changed();
  } catch (error) {
    if (error instanceof api.ApiError && [401, 403].includes(error.status))
      window.dispatchEvent(new Event('myt-identity-changed'));
  } finally {
    syncing = false;
    changed();
  }
}
export async function retry(item: Queued) {
  api.liveLease();
  if (item.status === 'conflict')
    throw new api.ApiError(409, 'review_required');
  item.status = 'pending';
  item.error = '';
  item.nextRetryAt = 0;
  await vault.put(item.scope, `queue:${item.command.operationId}`, item);
  changed();
  void synchronize();
}
export async function reconcile(item: Queued, latestVersion: number) {
  if (item.status !== 'conflict' || !api.allowed('payments.reverse'))
    throw new api.ApiError(403, 'forbidden');
  const data = {
    ...(item.command.data as Record<string, unknown>),
    ...(item.command.action === 'payment.create'
      ? { expectedVersion: latestVersion }
      : {}),
  };
  const replacement: Queued = {
    ...item,
    status: 'pending',
    createdAt: item.createdAt + 0.1,
    attempts: 0,
    nextRetryAt: 0,
    error: '',
    command: {
      ...item.command,
      operationId: crypto.randomUUID(),
      data,
      ...(item.command.expectedVersion !== undefined
        ? { expectedVersion: latestVersion }
        : {}),
    },
  };
  item.status = 'superseded';
  await vault.put(item.scope, `queue:${item.command.operationId}`, item);
  await vault.put(
    item.scope,
    `queue:${replacement.command.operationId}`,
    replacement,
  );
  changed();
  void synchronize();
}
export async function offlineIdentity(): Promise<Identity | undefined> {
  return vault.get('device-session', vault.deviceId());
}

export async function mutate<T>(
  action: Command['action'],
  data: unknown,
  options: {
    operationId?: string;
    resource?: Command['resource'];
    targetId?: string;
    expectedVersion?: number;
  } = {},
): Promise<T> {
  const release = api.beginWrite();
  try {
    return await performMutation<T>(action, data, options);
  } finally {
    release();
  }
}
