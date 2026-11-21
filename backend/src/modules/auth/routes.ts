import { Router } from 'express';
import { z } from 'zod';
import { randomUUID, randomInt } from 'node:crypto';
import argon2 from 'argon2';
import { rateLimit } from 'express-rate-limit';
import {
  permissions,
  rolePermissions,
  effectivePermissions,
  type Permission,
} from '@myt/shared';
import { User, type UserRecord } from '../../database/models.js';
import {
  CaptchaChallenge,
  LoginAttempt,
  UserSession,
  SecurityAuditLog,
  RefreshToken,
} from './models.js';
import {
  activeBranches,
  digest,
  hashPassword,
  normalizeName,
  sign,
  equal,
  cookie,
  cookies,
  clearCookies,
  event,
  profile,
  usable,
  getSession,
  startSession,
  secret,
} from './core.js';
import {
  resolveIdentity,
  requirePermission,
  type Actor,
} from '../../security/identity.js';
import { HttpError } from '../../utils/errors.js';
import type { Environment } from '../../config/env.js';

const password = z.string().min(8).max(128);
const role = z.enum(['admin', 'manager', 'employee']);
const branch = z.enum(['sham-royal', 'sham-aroos', 'sham-aroos-vip', 'dollar']);
const email = z.string().trim().toLowerCase().max(254).pipe(z.email());
const name = z
  .string()
  .min(1)
  .max(160)
  .transform(normalizeName)
  .refine(Boolean);
const grants = z.array(z.enum(permissions)).max(permissions.length);
export const accountInput = z
  .object({
    name,
    email,
    role,
    branchId: branch.nullable(),
    allow: grants.default([]),
    deny: grants.default([]),
    accountStatus: z
      .enum(['active', 'suspended', 'deactivated'])
      .default('active'),
    language: z.enum(['en', 'fa-AF', 'ps-AF']).default('fa-AF'),
  })
  .strict();
export const employeeDelegable: Permission[] = [
  ...permissions.filter((p) =>
    ['products', 'product-categories', 'guarantees', 'package-items'].some(
      (resource) => p === `${resource}.create` || p === `${resource}.update`,
    ),
  ),
  ...rolePermissions.employee,
  'catalog.write',
  'delivery.write',
  'transactions.read.all',
  'reports.read',
  'exports.read',
];
const dummy = hashPassword('Dummy-Password-Not-An-Account-123');
function safeUser(user: UserRecord) {
  const {
    _id,
    name,
    normalizedEmail,
    role,
    branchIds,
    assignedBranchId,
    allow,
    deny,
    accountStatus,
    language,
    grantVersion,
    lastLoginAt,
    createdAt,
  } = user;
  return {
    _id,
    name,
    email: normalizedEmail,
    role,
    branchIds,
    assignedBranchId,
    allow,
    deny,
    accountStatus,
    language,
    grantVersion,
    lastLoginAt,
    createdAt,
  };
}
function admin(actor: Actor) {
  if (actor.role !== 'admin') throw new HttpError(403, 'forbidden');
}
function managed(
  actor: Actor,
  user: { _id: string; role: string; branchIds: string[] },
) {
  requirePermission(actor, 'users.manage');
  if (actor.subject === user._id)
    throw new HttpError(403, 'self_grant_change_denied');
  if (
    actor.role !== 'admin' &&
    (actor.role !== 'manager' ||
      user.role !== 'employee' ||
      user.branchIds.length !== 1 ||
      user.branchIds[0] !== actor.branchIds[0])
  )
    throw new HttpError(403, 'forbidden');
}
function assignment(actor: Actor, data: z.output<typeof accountInput>) {
  if (data.role === 'admin' ? data.branchId !== null : !data.branchId)
    throw new HttpError(422, 'invalid_branch_assignment');
  if (actor.role !== 'admin') {
    if (
      actor.role !== 'manager' ||
      data.role !== 'employee' ||
      data.branchId !== actor.branchIds[0]
    )
      throw new HttpError(403, 'forbidden');
    if (
      data.allow.some(
        (p) => !employeeDelegable.includes(p) || !actor.permissions.includes(p),
      ) ||
      data.deny.some((p) => !employeeDelegable.includes(p))
    )
      throw new HttpError(403, 'delegation_denied');
    // Role defaults and catalog.write expansion must obey the same delegation ceiling.
    if (
      effectivePermissions(data.role, data.allow, data.deny).some(
        (p) => !employeeDelegable.includes(p) || !actor.permissions.includes(p),
      )
    )
      throw new HttpError(403, 'delegation_denied');
  }
  if (data.allow.length || data.deny.length)
    requirePermission(actor, 'permissions.assign');
  // Administrative authority is role-bound even if an employee is granted an invalid override.
  if (
    data.role === 'employee' &&
    data.allow.some((p) =>
      [
        'users.manage',
        'users.create',
        'users.update',
        'users.password',
        'permissions.assign',
        'security.read',
        'sessions.manage',
        'global.read',
        'settings.write',
      ].includes(p),
    )
  )
    throw new HttpError(403, 'delegation_denied');
  return data.role === 'admin' ? activeBranches : [data.branchId!];
}
export function authRouter(env: Environment) {
  const router = Router();
  const limited = (limit: number) =>
    rateLimit({
      windowMs: 15 * 60_000,
      limit,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (_req, _res, next) => next(new HttpError(429, 'rate_limited')),
    });
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  router.get('/auth/captcha', limited(100), async (req, res) => {
    const a = randomInt(10, 40),
      b = randomInt(1, 10),
      id = randomUUID();
    const accessible = req.query.mode === 'accessible';
    const answer = accessible
      ? String(a + b)
      : Array.from(
          { length: 6 },
          () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)],
        ).join('');
    const expiresAt = new Date(Date.now() + 2 * 60_000);
    await CaptchaChallenge.create({
      _id: id,
      answerHash: sign(`${id}:${answer}`, env),
      expiresAt,
    });
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="70" viewBox="0 0 240 70"><rect width="240" height="70" fill="#eff4ec"/><path d="M0 20L240 53M0 60L240 10M5 45L230 30" stroke="#acc3b3" fill="none"/>${answer
      .split('')
      .map(
        (letter, i) =>
          `<text x="${18 + i * 35}" y="${43 + randomInt(-6, 7)}" transform="rotate(${randomInt(-12, 13)} ${18 + i * 35} 40)" font-size="30" font-family="monospace" fill="#163b30">${letter}</text>`,
      )
      .join('')}</svg>`;
    res.json({
      data: {
        challenge: `${id}.${sign(id, env)}`,
        expiresAt,
        ...(accessible
          ? { question: `${a} + ${b} = ?` }
          : {
              image: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
            }),
      },
    });
  });
  router.post('/auth/login', limited(40), async (req, res) => {
    const input = z
      .object({
        role,
        branchId: branch.nullable(),
        name,
        email,
        password: z.string().min(1).max(128),
        challenge: z.string().max(150),
        answer: z.string().trim().min(1).max(20),
      })
      .strict()
      .parse(req.body);
    const bucket = digest(`${req.ip}:${input.email}`),
      ipBucket = digest(`ip:${req.ip}`);
    for (const key of [bucket, ipBucket]) {
      const locked = await LoginAttempt.findById(key);
      if (locked?.lockedUntil && locked.lockedUntil > new Date())
        throw new HttpError(429, 'rate_limited');
    }
    const [id, signature] = input.challenge.split('.');
    const challenge =
      id && signature && equal(signature, sign(id, env))
        ? await CaptchaChallenge.findOneAndDelete({ _id: id }).select(
            '+answerHash',
          )
        : null;
    const captchaOK =
      challenge &&
      challenge.expiresAt > new Date() &&
      equal(
        challenge.answerHash,
        sign(`${id}:${input.answer.toUpperCase()}`, env),
      );
    const user = await User.findOne({ normalizedEmail: input.email }).select(
      '+passwordHash +failedLogins +lockedUntil',
    );
    const passwordOK = await argon2
      .verify(user?.passwordHash || (await dummy), input.password)
      .catch(() => false);
    const valid =
      captchaOK &&
      passwordOK &&
      usable(user) &&
      (!user!.lockedUntil || user!.lockedUntil < new Date()) &&
      normalizeName(user!.name) === input.name &&
      user!.role === input.role &&
      (user!.role === 'admin'
        ? input.branchId === null
        : user!.branchIds.length === 1 &&
          user!.branchIds[0] === input.branchId);
    if (!valid) {
      for (const [key, threshold] of [
        [bucket, 5],
        [ipBucket, 25],
      ] as const) {
        await LoginAttempt.updateOne(
          {
            _id: key,
            windowStart: { $lt: new Date(Date.now() - 15 * 60_000) },
          },
          {
            $set: { failures: 0, windowStart: new Date() },
            $unset: { lockedUntil: '' },
          },
        );
        const attempt = await LoginAttempt.findOneAndUpdate(
          { _id: key },
          {
            $inc: { failures: 1 },
            $setOnInsert: { windowStart: new Date() },
            $set: { expiresAt: new Date(Date.now() + 86400_000) },
          },
          { upsert: true, new: true },
        );
        if ((attempt.failures || 0) >= threshold)
          await LoginAttempt.updateOne(
            { _id: key },
            { $set: { lockedUntil: new Date(Date.now() + 15 * 60_000) } },
          );
      }
      if (user) {
        user.failedLogins = (user.failedLogins || 0) + 1;
        if (user.failedLogins >= 5)
          user.lockedUntil = new Date(Date.now() + 15 * 60_000);
        await user.save();
      }
      await event(req, 'login.failed', user?._id);
      throw new HttpError(401, 'login_failed');
    }
    user!.failedLogins = 0;
    user!.set('lockedUntil', undefined);
    user!.lastLoginAt = new Date();
    await user!.save();
    await LoginAttempt.deleteOne({ _id: bucket });
    const identity = await startSession(req, res, user!, env);
    await event(req, 'login.success', user!._id);
    res.json({ data: identity });
  });
  router.post('/auth/refresh', limited(100), async (req, res) => {
    const hash = digest(cookie(req, 'myt_refresh'));
    const access = secret(),
      refresh = secret();
    const rotated = await UserSession.findOneAndUpdate(
      { refreshHash: hash, revokedAt: null, expiresAt: { $gt: new Date() } },
      {
        $set: {
          accessHash: digest(access),
          previousRefreshHash: hash,
          refreshHash: digest(refresh),
          accessExpiresAt: new Date(Date.now() + 15 * 60_000),
          lastSeenAt: new Date(),
        },
      },
      { new: true },
    );
    if (!rotated) {
      await UserSession.updateMany(
        { previousRefreshHash: hash },
        { $set: { revokedAt: new Date() } },
      );
      const used = await RefreshToken.findById(hash);
      if (used) {
        await UserSession.updateOne(
          { _id: used.sessionId },
          { $set: { revokedAt: new Date() } },
        );
        await event(req, 'refresh.reuse', '', used.sessionId || '');
      }
      clearCookies(res, env);
      throw new HttpError(401, 'session_expired');
    }
    await RefreshToken.create({
      _id: digest(refresh),
      sessionId: rotated._id,
      expiresAt: rotated.expiresAt,
    });
    const user = await User.findById(rotated.userId).select('+passwordHash');
    if (!usable(user)) {
      await UserSession.updateOne(
        { _id: rotated._id },
        { $set: { revokedAt: new Date() } },
      );
      clearCookies(res, env);
      throw new HttpError(401, 'session_expired');
    }
    cookies(res, access, refresh, env);
    res.json({
      data: profile(
        user!,
        new Date(
          Math.min(Date.now() + 8 * 3600000, rotated.expiresAt.getTime()),
        ).toISOString(),
        env,
        req.get('x-myt-device') || '',
      ),
    });
  });
  router.post('/auth/logout', async (req, res) => {
    const session = await UserSession.findOne({
      $or: [
        { accessHash: digest(cookie(req, 'myt_access')) },
        { refreshHash: digest(cookie(req, 'myt_refresh')) },
      ],
    });
    if (session) {
      await UserSession.updateOne(
        { _id: session._id },
        { $set: { revokedAt: new Date() } },
      );
      await event(req, 'logout', session.userId);
    }
    clearCookies(res, env);
    res.json({ data: { ok: true } });
  });
  router.use(async (req, res, next) => {
    // Only handle the explicitly owned groups, leaving versioned business routes intact.
    if (
      !/^\/(auth|users|roles|permissions|sessions|security)(\/|$)/.test(
        req.path,
      )
    )
      return next('router');
    try {
      res.locals.actor = await resolveIdentity(req, env);
      next();
    } catch (error) {
      next(error);
    }
  });
  router.get('/auth/me', (_req, res) => res.json({ data: res.locals.actor }));
  router.post('/auth/password', async (req, res) => {
    const data = z
      .object({ currentPassword: z.string().max(128), password })
      .strict()
      .parse(req.body);
    const { user } = await getSession(req);
    if (!(await argon2.verify(user.passwordHash!, data.currentPassword)))
      throw new HttpError(401, 'login_failed');
    user.passwordHash = await hashPassword(data.password);
    await user.save();
    await UserSession.updateMany(
      { userId: user._id },
      { $set: { revokedAt: new Date() } },
    );
    await event(req, 'password.change', user._id);
    clearCookies(res, env);
    res.json({ data: { ok: true } });
  });
  router.post('/auth/logout-all', async (req, res) => {
    const actor = res.locals.actor as Actor;
    await UserSession.updateMany(
      { userId: actor.subject },
      { $set: { revokedAt: new Date() } },
    );
    await event(req, 'logout.all', actor.subject);
    clearCookies(res, env);
    res.json({ data: { ok: true } });
  });
  router.get('/users', async (_req, res) => {
    const actor = res.locals.actor as Actor;
    requirePermission(actor, 'users.manage');
    if (!['admin', 'manager'].includes(actor.role))
      throw new HttpError(403, 'forbidden');
    const users = await User.find(
      actor.role === 'admin'
        ? {}
        : { role: 'employee', branchIds: { $size: 1, $all: actor.branchIds } },
    )
      .select('+normalizedEmail')
      .limit(500)
      .lean();
    res.json({ data: users.map((u) => safeUser(u)) });
  });
  router.post('/users', async (req, res) => {
    const actor = res.locals.actor as Actor;
    requirePermission(actor, 'users.create');
    requirePermission(actor, 'users.manage');
    const data = accountInput.extend({ password }).parse(req.body);
    const branchIds = assignment(actor, data);
    try {
      const user = await User.create({
        _id: randomUUID(),
        name: data.name,
        normalizedEmail: data.email,
        passwordHash: await hashPassword(data.password),
        role: data.role,
        branchIds,
        assignedBranchId: data.branchId,
        allow: data.allow,
        deny: data.deny,
        accountStatus: data.accountStatus,
        disabled: data.accountStatus !== 'active',
        language: data.language,
        createdBy: actor.subject,
        updatedBy: actor.subject,
      });
      await event(
        req,
        'account.create',
        actor.subject,
        user._id,
        data.branchId || '',
      );
      res.status(201).json({ data: safeUser(user.toObject()) });
    } catch (error) {
      if ((error as { code?: number }).code === 11000)
        throw new HttpError(409, 'duplicate_record');
      throw error;
    }
  });
  router.patch('/users/:id', async (req, res) => {
    const actor = res.locals.actor as Actor;
    requirePermission(actor, 'users.update');
    const data = accountInput
      .extend({ expectedVersion: z.number().int().min(1) })
      .parse(req.body);
    const target = await User.findById(z.uuid().parse(req.params.id));
    if (!target) throw new HttpError(404, 'not_found');
    managed(actor, target);
    const branchIds = assignment(actor, data);
    requirePermission(actor, 'permissions.assign');
    try {
      const user = await User.findOneAndUpdate(
        { _id: target._id, grantVersion: data.expectedVersion },
        {
          $set: {
            name: data.name,
            normalizedEmail: data.email,
            role: data.role,
            branchIds,
            assignedBranchId: data.branchId,
            allow: data.allow,
            deny: data.deny,
            accountStatus: data.accountStatus,
            disabled: data.accountStatus !== 'active',
            language: data.language,
            updatedBy: actor.subject,
          },
          $inc: { grantVersion: 1 },
        },
        { new: true, runValidators: true },
      ).select('+normalizedEmail');
      if (!user) throw new HttpError(409, 'version_conflict');
      await UserSession.updateMany(
        { userId: user._id },
        { $set: { revokedAt: new Date() } },
      );
      await event(
        req,
        'account.update',
        actor.subject,
        user._id,
        data.branchId || '',
      );
      res.json({ data: safeUser(user.toObject()) });
    } catch (error) {
      if ((error as { code?: number }).code === 11000)
        throw new HttpError(409, 'duplicate_record');
      throw error;
    }
  });
  router.post('/users/:id/password', async (req, res) => {
    const actor = res.locals.actor as Actor;
    requirePermission(actor, 'users.password');
    const data = z.object({ password }).strict().parse(req.body);
    const user = await User.findById(z.uuid().parse(req.params.id));
    if (!user) throw new HttpError(404, 'not_found');
    managed(actor, user);
    user.passwordHash = await hashPassword(data.password);
    user.failedLogins = 0;
    user.set('lockedUntil', undefined);
    user.updatedBy = actor.subject;
    await user.save();
    await UserSession.updateMany(
      { userId: user._id },
      { $set: { revokedAt: new Date() } },
    );
    await event(
      req,
      'password.reset',
      actor.subject,
      user._id,
      user.branchIds[0],
    );
    res.json({ data: { ok: true } });
  });
  router.get('/roles', (_req, res) => {
    requirePermission(res.locals.actor, 'users.manage');
    res.json({ data: rolePermissions });
  });
  router.get('/permissions', (_req, res) => {
    const actor = res.locals.actor as Actor;
    requirePermission(actor, 'users.manage');
    res.json({
      data: {
        permissions:
          actor.role === 'admin'
            ? permissions
            : employeeDelegable.filter((p) => actor.permissions.includes(p)),
        roles: rolePermissions,
      },
    });
  });
  router.get('/sessions', async (_req, res) => {
    const actor = res.locals.actor as Actor;
    const global =
      actor.role === 'admin' && actor.permissions.includes('sessions.manage');
    const rows = await UserSession.find({
      ...(global ? {} : { userId: actor.subject }),
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    })
      .select(
        '_id userId ip device lastSeenAt accessExpiresAt expiresAt createdAt',
      )
      .limit(500)
      .lean();
    res.json({ data: rows });
  });
  router.delete('/sessions/:id', async (req, res) => {
    const actor = res.locals.actor as Actor;
    const global =
      actor.role === 'admin' && actor.permissions.includes('sessions.manage');
    const id = z.uuid().parse(req.params.id);
    const session = await UserSession.findOne({
      _id: id,
      ...(global ? {} : { userId: actor.subject }),
    });
    if (!session) throw new HttpError(404, 'not_found');
    await UserSession.updateOne(
      { _id: id },
      { $set: { revokedAt: new Date() } },
    );
    await event(req, 'session.revoke', actor.subject, session.userId);
    res.json({ data: { ok: true } });
  });
  router.get('/security/audit', async (_req, res) => {
    const actor = res.locals.actor as Actor;
    admin(actor);
    requirePermission(actor, 'security.read');
    res.json({
      data: await SecurityAuditLog.find()
        .sort({ createdAt: -1 })
        .limit(250)
        .lean(),
    });
  });
  return router;
}
