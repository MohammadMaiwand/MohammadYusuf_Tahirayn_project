import { jwtVerify } from 'jose';
import type { Environment } from '../config/env.js';
import { HttpError } from '../utils/errors.js';
import type { Principal } from './branchScope.js';
export async function verifyAccessToken(
  token: string,
  env: Environment,
): Promise<Principal> {
  if (!env.JWT_SECRET)
    throw new HttpError(503, 'Authentication is not configured');
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(env.JWT_SECRET),
      {
        algorithms: ['HS256'],
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
        requiredClaims: ['exp', 'iat', 'sub'],
      },
    );
    if (
      !payload.sub ||
      !Array.isArray(payload.branchIds) ||
      !payload.branchIds.every((v) => typeof v === 'string')
    )
      throw new Error('Invalid claims');
    return { subject: payload.sub, branchIds: payload.branchIds as string[] };
  } catch {
    throw new HttpError(401, 'Invalid access token');
  }
}
