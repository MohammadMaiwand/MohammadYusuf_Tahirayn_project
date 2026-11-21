import { describe, it, expect } from 'vitest';
import { generateKeyPairSync, sign } from 'node:crypto';
import type { SessionIdentity } from '@myt/shared';
import { verifyOfflineLease } from '../src/security/offlineLease';
describe('signed offline authorization', () => {
  it('rejects expired, cross-device and forged permissions/branches instead of trusting encrypted browser data', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const key = publicKey
      .export({ format: 'der', type: 'spki' })
      .toString('base64');
    const value: SessionIdentity = {
      subject: 'fixture',
      name: 'Fixture',
      role: 'employee',
      branchIds: ['sham-royal'],
      permissions: ['customers.read'],
      development: false,
      language: 'en',
      deviceId: 'device-1',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };
    value.offlineProof = sign(
      null,
      Buffer.from(JSON.stringify(value)),
      privateKey,
    ).toString('base64');
    expect(await verifyOfflineLease(value, key, 'device-1')).toBe(true);
    expect(await verifyOfflineLease(value, key, 'device-2')).toBe(false);
    expect(
      await verifyOfflineLease(
        { ...value, role: 'admin', permissions: ['users.manage'] },
        key,
        'device-1',
      ),
    ).toBe(false);
    expect(
      await verifyOfflineLease(
        { ...value, branchIds: ['sham-aroos'] },
        key,
        'device-1',
      ),
    ).toBe(false);
    expect(
      await verifyOfflineLease(
        { ...value, expiresAt: new Date(Date.now() - 1).toISOString() },
        key,
        'device-1',
      ),
    ).toBe(false);
    expect(
      await verifyOfflineLease(
        { ...value, offlineProof: 'forged' },
        key,
        'device-1',
      ),
    ).toBe(false);
    expect(await verifyOfflineLease(value, '', 'device-1')).toBe(false);
  });
});
