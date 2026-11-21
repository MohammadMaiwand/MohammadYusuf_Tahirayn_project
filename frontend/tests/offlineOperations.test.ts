import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import * as api from '../src/services/api';
import * as vault from '../src/offline/vault';
import { env } from '../src/lib/env';
import { mutate } from '../src/offline/operations';

vi.mock('../src/lib/env', () => ({
  env: { VITE_OFFLINE_SYNC_ENABLED: 'true' },
}));
vi.mock('../src/services/api', () => ({
  ApiError: class extends Error {
    constructor(
      public status: number,
      public code: string,
    ) {
      super(code);
    }
  },
  scope: () => 'review-scope',
  branch: () => 'sham-royal',
  beginWrite: vi.fn(() => vi.fn()),
  liveLease: vi.fn(),
  allowed: vi.fn(() => true),
  session: () => ({ subject: 'review-user', name: 'Review user' }),
  request: vi.fn(),
  get: vi.fn(),
  cachedEntity: vi.fn(),
  cacheEntity: vi.fn(),
}));
vi.mock('../src/offline/vault', () => ({
  deviceId: () => '11111111-1111-4111-8111-111111111111',
  entries: vi.fn(),
  putMany: vi.fn(),
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('navigator', { onLine: false });
  env.VITE_OFFLINE_SYNC_ENABLED = 'true';
  vi.mocked(vault.entries).mockResolvedValue([]);
  vi.mocked(api.cacheEntity).mockResolvedValue(undefined);
  vi.mocked(api.get).mockResolvedValue({
    currency: 'AFN',
    offlinePayments: true,
    offlinePaymentLimitMinor: 100000,
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('mutation acknowledgement and offline record parity', () => {
  it('returns a committed payment even when browser caching fails and never queues it again', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    env.VITE_OFFLINE_SYNC_ENABLED = 'false';
    const result = {
      payment: { _id: randomUUID() },
      transaction: { _id: randomUUID(), paidMinor: 1000 },
    };
    vi.mocked(api.request).mockImplementation(async (_path, init) => {
      const command = JSON.parse(String(init?.body));
      return command.action === 'device.register' ? {} : result;
    });
    vi.mocked(api.cacheEntity).mockRejectedValue(
      new Error('QuotaExceededError'),
    );
    const events: string[] = [];
    window.addEventListener('myt-toast', (event) =>
      events.push((event as CustomEvent<string>).detail),
    );
    await expect(
      mutate('payment.create', {
        transactionId: result.transaction._id,
        amount: '10',
        method: 'cash',
        expectedVersion: 1,
      }),
    ).resolves.toEqual(result);
    expect(vault.putMany).not.toHaveBeenCalled();
    expect(events).toContain('error.storage_unavailable');
    const writes = vi
      .mocked(api.request)
      .mock.calls.filter(
        ([, init]) =>
          JSON.parse(String(init?.body)).action === 'payment.create',
      );
    expect(writes).toHaveLength(1);
  });
  it('refuses offline payments on cancelled transactions before writing the outbox', async () => {
    vi.mocked(api.cachedEntity).mockResolvedValue({
      _id: randomUUID(),
      status: 'cancelled',
      currency: 'AFN',
      paidMinor: 0,
      totalMinor: 10000,
    });
    await expect(
      mutate('payment.create', {
        transactionId: randomUUID(),
        amount: '10',
        method: 'cash',
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: 'transaction_cancelled' });
    expect(vault.putMany).not.toHaveBeenCalled();
  });
  it('preserves original product currency and the selected return date offline', async () => {
    const customerId = randomUUID(),
      productId = randomUUID();
    vi.mocked(api.cachedEntity).mockImplementation(async (resource) =>
      resource === 'customers'
        ? { _id: customerId, fullName: 'Review customer' }
        : {
            _id: productId,
            code: 'PRODUCT-1',
            name: 'Review dress',
            priceMinor: 5000,
            currency: 'USD',
          },
    );
    const date = '2026-11-20T19:30:00.000Z';
    const result = await mutate<{
      product: { currency: string };
      returnDueAt: string;
    }>('transaction.create', {
      customerId,
      productId,
      type: 'rental',
      agreedPrice: '10',
      advance: '0',
      packages: [],
      reservationAt: date,
      returnDueAt: date,
    });
    expect(result.product.currency).toBe('USD');
    expect(result.returnDueAt).toBe(date);
    expect(vault.putMany).toHaveBeenCalledTimes(1);
  });
});
