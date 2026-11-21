import { it, expect } from 'vitest';
import { SignJWT } from 'jose';
import { parseEnv } from '../src/config/env.js';
import { verifyAccessToken } from '../src/security/token.js';

const env = parseEnv({
  MONGODB_URI: 'mongodb://localhost/test',
  JWT_SECRET: 'a-test-only-key-with-at-least-32-characters',
});
const key = new TextEncoder().encode(env.JWT_SECRET);
function sign(audience = env.JWT_AUDIENCE, expires = '5m') {
  return new SignJWT({ branchIds: ['sham-royal'] })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(env.JWT_ISSUER)
    .setAudience(audience)
    .setSubject('test-only')
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(key);
}
it('validates token signature and rejects wrong audience, expiry and missing configuration', async () => {
  expect(await verifyAccessToken(await sign(), env)).toEqual({
    subject: 'test-only',
    branchIds: ['sham-royal'],
  });
  await expect(
    verifyAccessToken(await sign('wrong-audience'), env),
  ).rejects.toThrow('Invalid access token');
  await expect(
    verifyAccessToken(await sign(env.JWT_AUDIENCE, '-1s'), env),
  ).rejects.toThrow('Invalid access token');
  await expect(
    verifyAccessToken(
      'invalid',
      parseEnv({ MONGODB_URI: 'mongodb://localhost/test' }),
    ),
  ).rejects.toThrow('not configured');
});
