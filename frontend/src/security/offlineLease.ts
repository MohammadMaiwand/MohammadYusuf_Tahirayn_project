import type { SessionIdentity } from '@myt/shared';
export async function verifyOfflineLease(
  value: SessionIdentity,
  publicKey: string,
  deviceId: string,
) {
  if (
    !Number.isFinite(Date.parse(value.expiresAt)) ||
    Date.parse(value.expiresAt) <= Date.now()
  )
    return false;
  if (!publicKey) return value.development === true;
  if (value.development || !value.offlineProof || value.deviceId !== deviceId)
    return false;
  try {
    const { offlineProof, ...payload } = value;
    const bytes = (base64: string) =>
      Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const key = await crypto.subtle.importKey(
      'spki',
      bytes(publicKey),
      { name: 'Ed25519' },
      false,
      ['verify'],
    );
    return await crypto.subtle.verify(
      'Ed25519',
      key,
      bytes(offlineProof),
      new TextEncoder().encode(JSON.stringify(payload)),
    );
  } catch {
    return false;
  }
}
