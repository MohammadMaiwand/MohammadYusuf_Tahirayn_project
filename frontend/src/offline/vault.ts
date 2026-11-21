import Dexie, { type EntityTable } from 'dexie';
interface Stored {
  key: string;
  scope: string;
  iv: number[];
  cipher: ArrayBuffer;
  updatedAt: number;
}
const db = new Dexie('myt-secure-device-v1') as Dexie & {
  vault: EntityTable<Stored, 'key'>;
  keys: EntityTable<{ id: string; value: CryptoKey }, 'id'>;
};
db.version(1).stores({ vault: '&key,scope,updatedAt', keys: '&id' });
let keyPromise: Promise<CryptoKey> | undefined;
function key() {
  keyPromise ??= (async () => {
    const stored = await db.keys.get('device');
    if (stored) return stored.value;
    const value = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
    try {
      await db.keys.add({ id: 'device', value });
      return value;
    } catch {
      const concurrent = await db.keys.get('device');
      if (!concurrent) throw new Error('storage_unavailable');
      return concurrent.value;
    }
  })();
  return keyPromise;
}
export async function put<T>(scope: string, id: string, value: T) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: new TextEncoder().encode(`${scope}:${id}`),
    },
    await key(),
    new TextEncoder().encode(JSON.stringify(value)),
  );
  await db.vault.put({
    key: `${scope}:${id}`,
    scope,
    iv: [...iv],
    cipher,
    updatedAt: Date.now(),
  });
}
export async function putMany(
  scope: string,
  values: { id: string; value: unknown }[],
) {
  const encryptionKey = await key();
  const records: Stored[] = [];
  for (const item of values) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData: new TextEncoder().encode(`${scope}:${item.id}`),
      },
      encryptionKey,
      new TextEncoder().encode(JSON.stringify(item.value)),
    );
    records.push({
      key: `${scope}:${item.id}`,
      scope,
      iv: [...iv],
      cipher,
      updatedAt: Date.now(),
    });
  }
  await db.transaction('rw', db.vault, () => db.vault.bulkPut(records));
}
async function decode<T>(stored: Stored, id: string): Promise<T> {
  const bytes = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(stored.iv),
      additionalData: new TextEncoder().encode(`${stored.scope}:${id}`),
    },
    await key(),
    stored.cipher,
  );
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}
export async function get<T>(
  scope: string,
  id: string,
): Promise<T | undefined> {
  const stored = await db.vault.get(`${scope}:${id}`);
  return stored ? decode<T>(stored, id) : undefined;
}
export async function entries<T>(
  scope: string,
  prefix: string,
): Promise<{ id: string; value: T }[]> {
  const records = await db.vault
    .where('scope')
    .equals(scope)
    .filter((row) => row.key.startsWith(`${scope}:${prefix}`))
    .toArray();
  return Promise.all(
    records.map(async (row) => {
      const id = row.key.slice(scope.length + 1);
      return { id, value: await decode<T>(row, id) };
    }),
  );
}
export function deviceId() {
  let id = localStorage.getItem('myt-device-id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('myt-device-id', id);
  }
  return id;
}
export async function scopeId(
  subject: string,
  branchId: string,
  permissions: readonly string[],
) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode([...permissions].sort().join('|')),
  );
  return `${subject}|${branchId}|${deviceId()}|${Array.from(
    new Uint8Array(digest),
  )
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')}`;
}

export async function clearSession() {
  await db.vault.where('scope').equals('device-session').delete();
}
