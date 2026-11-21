import { calendarDay } from '@myt/shared';
import type { Identity, Page, Entity } from '../types/business';
import { env } from '../lib/env';
import * as vault from '../offline/vault';
import { verifyOfflineLease } from '../security/offlineLease';
declare global {
  interface Window {
    mytIdentity?: { accessToken: () => Promise<string | undefined> };
  }
}
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
let identity: Identity | undefined;
let currentBranch = 'sham-royal';
let currentScope = '';
let writes = 0;
export function beginWrite() {
  writes++;
  return () => {
    writes--;
  };
}
export function session() {
  return identity;
}
export function branch() {
  return currentBranch;
}
export function scope() {
  return currentScope;
}
export async function selectBranch(id: string, force = false) {
  if (writes && !force && id !== currentBranch)
    throw new ApiError(409, 'operation_in_progress');
  if (!identity?.branchIds.includes(id))
    throw new ApiError(403, 'branch_denied');
  currentBranch = id;
  currentScope = await vault.scopeId(
    identity.subject,
    id,
    identity.permissions,
  );
}
export async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await window.mytIdentity?.accessToken();
  const headers = new Headers(init.headers);
  headers.set('x-myt-request', '1');
  headers.set('x-myt-device', vault.deviceId());
  if (init.body) headers.set('content-type', 'application/json');
  if (token) headers.set('authorization', `Bearer ${token}`);
  let response: Response;
  try {
    response = await fetch(`${env.VITE_API_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers,
      signal: init.signal || AbortSignal.timeout(15000),
    });
    window.dispatchEvent(new CustomEvent('myt-network', { detail: true }));
  } catch (error) {
    window.dispatchEvent(new CustomEvent('myt-network', { detail: false }));
    throw error;
  }
  if (response.status === 401 && !path.startsWith('/auth/')) {
    if (await refreshSession()) {
      response = await fetch(`${env.VITE_API_URL}${path}`, {
        ...init,
        credentials: 'include',
        headers,
        signal: init.signal || AbortSignal.timeout(15000),
      });
    }
  }
  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => ({ error: { message: 'request_failed' } }));
    if (response.status === 401) {
      await vault.clearSession();
      identity = undefined;
      window.dispatchEvent(new Event('myt-auth-ended'));
    }
    throw new ApiError(
      response.status,
      body.error?.message || 'request_failed',
    );
  }
  return (await response.json()).data as T;
}
export async function bootstrap(): Promise<Identity> {
  if (localStorage.getItem('myt-logged-out') === 'true')
    throw new ApiError(401, 'identity_required');
  try {
    identity = await request<Identity>('/session');
    await vault.put('device-session', vault.deviceId(), identity);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    identity = await vault.get<Identity>('device-session', vault.deviceId());
    if (!identity || Date.parse(identity.expiresAt) < Date.now())
      throw new ApiError(401, 'offline_lease_expired');
    if (
      !(await verifyOfflineLease(
        identity,
        env.VITE_AUTH_PUBLIC_KEY,
        vault.deviceId(),
      ))
    )
      throw new ApiError(401, 'offline_lease_expired');
  }
  await selectBranch(
    identity.branchIds.includes(localStorage.getItem('myt-branch') || '')
      ? localStorage.getItem('myt-branch')!
      : identity.branchIds[0]!,
  );
  return identity;
}
export function allowed(permission: string) {
  return (
    identity?.permissions.some(
      (p) =>
        p === permission ||
        (permission === 'transactions.read.own' &&
          p === 'transactions.read.all'),
    ) || false
  );
}
export function liveLease() {
  if (!identity || Date.parse(identity.expiresAt) < Date.now())
    throw new ApiError(401, 'offline_lease_expired');
}
export async function cacheEntity(
  resource: string,
  value: Entity,
  destination = currentScope,
) {
  await vault.put(destination, `entity:${resource}:${value._id}`, value);
}
export async function cachedEntity<T>(resource: string, id: string) {
  liveLease();
  return vault.get<T>(currentScope, `entity:${resource}:${id}`);
}
export async function cacheResponse(
  path: string,
  value: unknown,
  destination = currentScope,
) {
  await vault.put(destination, `get:${path}`, value);
  const [resource, id] = path.split('?')[0]!.split('/').filter(Boolean);
  if (resource && value && typeof value === 'object') {
    const record = value as { items?: Entity[]; _id?: string };
    if (record.items)
      for (const item of record.items)
        await cacheEntity(resource, item, destination);
    else if (id && record._id)
      await cacheEntity(resource, record as Entity, destination);
  }
}
async function offlineList<T>(
  path: string,
  destination: string,
): Promise<Page<T> | undefined> {
  const [pathname, search] = path.split('?');
  const resource = pathname?.split('/').filter(Boolean)[0];
  if (!resource || pathname?.split('/').filter(Boolean).length !== 1) return;
  const values = await vault.entries<Entity & Record<string, unknown>>(
    destination,
    `entity:${resource}:`,
  );
  if (!values.length) return;
  const query = new URLSearchParams(search);
  const q = (query.get('q') || '').toLowerCase();
  let rows = values
    .map((item) => item.value)
    .filter(
      (row) =>
        !q ||
        [
          'name',
          'fullName',
          'code',
          'clothingId',
          'telephone',
          'customerName',
        ].some((field) =>
          String(row[field] || '')
            .toLowerCase()
            .includes(q),
        ),
    );
  for (const field of [
    'status',
    'type',
    'customerId',
    'transactionId',
    'brand',
    'color',
    'productType',
  ])
    if (query.get(field))
      rows = rows.filter((row) => row[field] === query.get(field));
  if (query.get('currency'))
    rows = rows.filter((row) => row.currency === query.get('currency'));
  if (query.get('outstanding') === 'true')
    rows = rows.filter(
      (row) =>
        row.status !== 'cancelled' &&
        Number(row.totalMinor) > Number(row.paidMinor),
    );
  if (query.get('upcoming') === 'true') {
    const today = calendarDay(new Date());
    rows = rows.filter(
      (row) =>
        ['pending', 'ready'].includes(String(row.status)) &&
        calendarDay(String(row.reservationAt)) >= today &&
        calendarDay(String(row.reservationAt)) < today + 7,
    );
  }
  if (query.get('from'))
    rows = rows.filter(
      (row) => String(row.orderAt || row.createdAt) >= query.get('from')!,
    );
  if (query.get('to'))
    rows = rows.filter(
      (row) => String(row.orderAt || row.createdAt) < query.get('to')!,
    );
  const sort = query.get('sort') || 'createdAt';
  rows.sort(
    (a, b) =>
      String(a[sort] || '').localeCompare(String(b[sort] || '')) *
      (query.get('direction') === 'asc' ? 1 : -1),
  );
  const page = Number(query.get('page') || 1),
    limit = Number(query.get('limit') || 25);
  return {
    items: rows.slice((page - 1) * limit, page * limit) as T[],
    total: rows.length,
    page,
    limit,
    offline: true,
  };
}
export async function get<T>(path: string): Promise<T> {
  const destination = currentScope,
    selectedBranch = currentBranch;
  try {
    const value = await request<T>(`/branches/${selectedBranch}${path}`);
    try {
      await cacheResponse(path, value, destination);
    } catch {
      window.dispatchEvent(
        new CustomEvent('myt-toast', { detail: 'error.storage_unavailable' }),
      );
    }
    return value;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (destination !== currentScope) throw new ApiError(403, 'branch_denied');
    liveLease();
    const list = await offlineList(path, destination);
    if (list) return list as T;
    const cached = await vault.get<T>(currentScope, `get:${path}`);
    const [resource, id] = path.split('?')[0]!.split('/').filter(Boolean);
    if (resource && id) {
      const item = await cachedEntity<T>(resource, id);
      if (item) return item;
    }
    if (cached !== undefined) return cached;
    throw new ApiError(503, 'not_cached');
  }
}
export async function refreshIdentity() {
  const updated = await request<Identity>('/session');
  if (
    updated.subject !== identity?.subject ||
    [...updated.permissions].sort().join() !==
      [...(identity?.permissions || [])].sort().join() ||
    !updated.branchIds.includes(currentBranch)
  ) {
    identity = updated;
    await selectBranch(updated.branchIds[0]!, true);
    window.dispatchEvent(new Event('myt-identity-changed'));
  } else identity = updated;
  await vault.put('device-session', vault.deviceId(), updated);
  return updated;
}

let refreshing: Promise<boolean> | undefined;
async function refreshSession() {
  refreshing ??= fetch(`${env.VITE_API_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'x-myt-request': '1', 'x-myt-device': vault.deviceId() },
    signal: AbortSignal.timeout(15000),
  })
    .then((response) => response.ok)
    .finally(() => {
      refreshing = undefined;
    });
  return refreshing;
}
export async function endSession() {
  try {
    await request('/auth/logout', { method: 'POST' });
  } catch {
    /* Local sign-out still removes the bounded lease while disconnected. */
  }
  await vault.clearSession();
  localStorage.setItem('myt-logged-out', 'true');
  identity = undefined;
  currentScope = '';
  currentBranch = 'sham-royal';
  localStorage.removeItem('myt-branch');
  window.dispatchEvent(new Event('myt-auth-ended'));
}
