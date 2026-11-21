import {
  sign as cryptoSign,
  createPrivateKey,
  createHash,
  randomBytes,
  randomUUID,
  createHmac,
  timingSafeEqual,
} from 'node:crypto';
import argon2 from 'argon2';
import type { Request, Response } from 'express';
import {
  branches,
  effectivePermissions,
  type SessionIdentity,
} from '@myt/shared';
import { User, type UserRecord } from '../../database/models.js';
import { UserSession, SecurityAuditLog, RefreshToken } from './models.js';
import { HttpError } from '../../utils/errors.js';
import type { Environment } from '../../config/env.js';

export const activeBranches = branches.filter((b) => b.active).map((b) => b.id);
export const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');
export const secret = () => randomBytes(32).toString('base64url');
export const normalizeName = (value: string) =>
  value.normalize('NFKC').trim().replace(/\s+/g, ' ');
export const hashPassword = (password: string) =>
  argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
export function sign(value: string, env: Environment) {
  if (!env.JWT_SECRET) throw new HttpError(503, 'auth_unavailable');
  return createHmac('sha256', env.JWT_SECRET).update(value).digest('hex');
}
export function equal(a: string, b: string) {
  const left = Buffer.from(a),
    right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function cookie(req: Request, name: string) {
  return (
    (req.headers.cookie || '')
      .split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith(name + '='))
      ?.slice(name.length + 1) || ''
  );
}
export function cookies(
  res: Response,
  access: string,
  refresh: string,
  env: Environment,
) {
  const common = {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/api/v1',
  };
  res.cookie('myt_access', access, { ...common, maxAge: 15 * 60_000 });
  res.cookie('myt_refresh', refresh, { ...common, maxAge: 7 * 86400_000 });
}
export function clearCookies(res: Response, env: Environment) {
  for (const key of ['myt_access', 'myt_refresh'])
    res.clearCookie(key, {
      path: '/api/v1',
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
    });
}
export async function event(
  req: Request,
  action: string,
  userId = '',
  targetId = '',
  branchId = '',
) {
  await SecurityAuditLog.create({
    userId,
    action,
    targetId,
    branchId,
    ip: req.ip?.slice(0, 80),
    device: req.get('user-agent')?.slice(0, 250) || '',
  });
}
export function profile(
  user: UserRecord,
  expiresAt = new Date(Date.now() + 8 * 3600_000).toISOString(),
  env?: Environment,
  deviceId = '',
): SessionIdentity {
  const scope = user.role === 'admin' ? activeBranches : user.branchIds;
  if (
    user.role !== 'admin' &&
    (scope.length !== 1 ||
      !activeBranches.includes(scope[0] as (typeof activeBranches)[number]))
  )
    throw new HttpError(403, 'branch_denied');
  const identity: SessionIdentity = {
    subject: user._id,
    name: user.name,
    role: user.role,
    branchIds: scope,
    permissions: effectivePermissions(user.role, user.allow, user.deny),
    development: false,
    language: user.language,
    expiresAt,
  };
  if (env?.AUTH_PRIVATE_KEY && /^[a-f0-9-]{36}$/.test(deviceId)) {
    identity.deviceId = deviceId;
    identity.offlineProof = cryptoSign(
      null,
      Buffer.from(JSON.stringify(identity)),
      createPrivateKey({
        key: Buffer.from(env.AUTH_PRIVATE_KEY, 'base64'),
        format: 'der',
        type: 'pkcs8',
      }),
    ).toString('base64');
  }
  return identity;
}
export function usable(user: UserRecord | null | undefined) {
  return (
    user &&
    !user.disabled &&
    user.accountStatus === 'active' &&
    user.passwordHash
  );
}
export async function getSession(req: Request, refresh = false) {
  const value = cookie(req, refresh ? 'myt_refresh' : 'myt_access');
  if (!value) throw new HttpError(401, 'identity_required');
  const session = await UserSession.findOne({
    [refresh ? 'refreshHash' : 'accessHash']: digest(value),
    revokedAt: null,
    expiresAt: { $gt: new Date() },
    ...(!refresh ? { accessExpiresAt: { $gt: new Date() } } : {}),
  });
  if (!session) throw new HttpError(401, 'session_expired');
  const user = await User.findById(session.userId).select('+passwordHash');
  if (!usable(user)) throw new HttpError(401, 'session_expired');
  return { session, user: user! };
}
export async function sessionIdentity(req: Request, env: Environment) {
  const { session, user } = await getSession(req);
  return profile(
    user,
    new Date(
      Math.min(Date.now() + 8 * 3600_000, session.expiresAt.getTime()),
    ).toISOString(),
    env,
    req.get('x-myt-device') || '',
  );
}
export async function startSession(
  req: Request,
  res: Response,
  user: UserRecord,
  env: Environment,
) {
  const access = secret(),
    refresh = secret();
  const session = await UserSession.create({
    _id: randomUUID(),
    userId: user._id,
    accessHash: digest(access),
    refreshHash: digest(refresh),
    accessExpiresAt: new Date(Date.now() + 15 * 60_000),
    expiresAt: new Date(Date.now() + 7 * 86400_000),
    lastSeenAt: new Date(),
    ip: req.ip?.slice(0, 80),
    device: req.get('user-agent')?.slice(0, 250) || '',
  });
  await RefreshToken.create({
    _id: digest(refresh),
    sessionId: session._id,
    expiresAt: session.expiresAt,
  });
  cookies(res, access, refresh, env);
  return profile(user, undefined, env, req.get('x-myt-device') || '');
}
