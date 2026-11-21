import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { parseEnv } from '../src/config/env.js';
import { User } from '../src/database/models.js';
import { initializeDatabase } from '../src/database/bootstrap.js';
import { migrateAuth } from '../src/database/authMigration.js';
import { hashPassword, activeBranches } from '../src/modules/auth/core.js';
import {
  UserSession,
  CaptchaChallenge,
  LoginAttempt,
  SecurityAuditLog,
} from '../src/modules/auth/models.js';

const database = `myt_auth_test_${randomUUID().replaceAll('-', '')}`;
const password = 'Test-Password-Secure-123';
const env = parseEnv({
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://127.0.0.1:27018/?replicaSet=myt-dev',
  LOG_LEVEL: 'silent',
  JWT_SECRET: 'test-secret-with-32-or-more-characters-auth',
  RATE_LIMIT_MAX: '10000',
});
const app = createApp(env, () => true);
const origin = 'http://127.0.0.1:5173';
const fixtures = [
  {
    name: 'Admin Fixture',
    email: 'admin@test.local',
    role: 'admin',
    branchId: null,
  },
  {
    name: 'Manager Fixture',
    email: 'manager@test.local',
    role: 'manager',
    branchId: 'sham-royal',
  },
  {
    name: 'Employee Fixture',
    email: 'employee@test.local',
    role: 'employee',
    branchId: 'sham-royal',
  },
];
async function challenge() {
  const result = await request(app).get('/api/v1/auth/captcha?mode=accessible');
  expect(result.status).toBe(200);
  const data = result.body.data as { challenge: string; question: string };
  const values = data.question.match(/\d+/g)!.map(Number);
  return { challenge: data.challenge, answer: String(values[0]! + values[1]!) };
}
async function login(index: number, override: Record<string, unknown> = {}) {
  const agent = request.agent(app);
  const data = {
    ...fixtures[index],
    password,
    ...(await challenge()),
    ...override,
  };
  const response = await agent
    .post('/api/v1/auth/login')
    .set('x-myt-request', '1')
    .set('Origin', origin)
    .send(data);
  return { agent, response };
}
const account = {
  name: 'New Employee',
  email: 'new@test.local',
  role: 'employee',
  branchId: 'sham-royal',
  password,
  allow: [],
  deny: [],
  accountStatus: 'active',
  language: 'en',
};
beforeAll(async () => {
  await mongoose.connect(env.MONGODB_URI, { dbName: database });
  await initializeDatabase();
  await migrateAuth();
  await migrateAuth();
  const passwordHash = await hashPassword(password);
  for (const fixture of fixtures)
    await User.create({
      _id: randomUUID(),
      name: fixture.name,
      normalizedEmail: fixture.email,
      passwordHash,
      role: fixture.role,
      branchIds: fixture.branchId ? [fixture.branchId] : activeBranches,
      assignedBranchId: fixture.branchId,
      allow: [],
      deny: [],
      disabled: false,
      accountStatus: 'active',
      language: 'en',
      createdBy: 'test',
      updatedBy: 'test',
    });
}, 30000);
beforeEach(async () => {
  await LoginAttempt.deleteMany({});
  await User.updateMany(
    {},
    { $set: { failedLogins: 0 }, $unset: { lockedUntil: '' } },
  );
});
afterAll(async () => {
  if (
    mongoose.connection.name !== database ||
    !/^myt_auth_test_[a-f0-9]{32}$/.test(database)
  )
    throw new Error('Unsafe auth cleanup');
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
describe('real authentication and account authorization', () => {
  it('accepts a simple eight-character password in Dollar and rejects shorter account passwords', async () => {
    const admin = await login(0);
    const create = (password: string) =>
      admin.agent
        .post('/api/v1/users')
        .set('x-myt-request', '1')
        .set('Origin', origin)
        .send({
          ...account,
          email: 'simple-dollar@test.local',
          branchId: 'dollar',
          password,
        });
    expect((await create('short')).status).toBe(422);
    expect((await create('abcdefgh')).status).toBe(201);
    const employee = await login(2, {
      name: account.name,
      email: 'simple-dollar@test.local',
      branchId: 'dollar',
      password: 'abcdefgh',
    });
    expect(employee.response.status).toBe(200);
    expect(
      (await employee.agent.get('/api/v1/branches/sham-royal/dashboard'))
        .status,
    ).toBe(403);
  });
  it('keeps persisted messages within branch scope and permits only branch management to publish', async () => {
    const manager = await login(1),
      employee = await login(2);
    const created = await manager.agent
      .post('/api/v1/branches/sham-royal/messages')
      .set('x-myt-request', '1')
      .send({ title: 'Branch notice', body: 'Delivery schedule' });
    expect(created.status).toBe(201);
    expect(
      (await employee.agent.get('/api/v1/branches/sham-royal/messages')).body
        .data.items[0].title,
    ).toBe('Branch notice');
    expect(
      (
        await employee.agent
          .post(
            `/api/v1/branches/sham-royal/messages/${created.body.data._id}/read`,
          )
          .set('x-myt-request', '1')
      ).status,
    ).toBe(200);
    for (const actor of [manager, employee]) {
      expect(
        (await actor.agent.get('/api/v1/branches/sham-aroos/messages')).status,
      ).toBe(403);
      expect(
        (
          await actor.agent
            .post('/api/v1/branches/sham-aroos/messages')
            .set('x-myt-request', '1')
            .send({ title: 'Denied', body: 'Denied' })
        ).status,
      ).toBe(403);
      expect(
        (
          await actor.agent
            .post(
              `/api/v1/branches/sham-aroos/messages/${created.body.data._id}/read`,
            )
            .set('x-myt-request', '1')
        ).status,
      ).toBe(403);
    }
    expect(
      (
        await employee.agent
          .post('/api/v1/branches/sham-royal/messages')
          .set('x-myt-request', '1')
          .send({ title: 'Denied', body: 'Denied' })
      ).status,
    ).toBe(403);
  });
  for (const [index, fixture] of fixtures.entries())
    it(`logs in ${fixture.role} with actual database grants and HttpOnly cookies`, async () => {
      const { agent, response } = await login(index);
      expect(response.status).toBe(200);
      expect(response.body.data.role).toBe(fixture.role);
      expect(response.body.data.branchIds).toEqual(
        fixture.branchId ? [fixture.branchId] : activeBranches,
      );
      const cookies = response.headers['set-cookie'] as unknown as string[];
      expect(
        cookies.every(
          (v) => v.includes('HttpOnly') && v.includes('SameSite=Strict'),
        ),
      ).toBe(true);
      expect(JSON.stringify(response.body)).not.toMatch(
        /passwordHash|refreshHash|accessHash/,
      );
      expect((await agent.get('/api/v1/auth/me')).status).toBe(200);
      for (const id of activeBranches)
        expect(
          (await agent.get(`/api/v1/branches/${id}/customers`)).status,
        ).toBe(fixture.role === 'admin' || id === fixture.branchId ? 200 : 403);
      expect(
        (await agent.get('/api/v1/branches/sham-shaban/customers')).status,
      ).toBe(403);
    });
  it('rejects incorrect password/name/email/role/branch and reveals only a generic login error', async () => {
    for (const value of [
      { password: 'wrong' },
      { name: 'Wrong Name' },
      { email: 'missing@test.local' },
      { role: 'admin', branchId: null },
      { branchId: 'sham-aroos' },
    ]) {
      await LoginAttempt.deleteMany({});
      await User.updateMany(
        {},
        { $set: { failedLogins: 0 }, $unset: { lockedUntil: '' } },
      );
      const { response } = await login(2, value);
      expect(response.status).toBe(401);
      expect(response.body.error.message).toBe('login_failed');
    }
    expect((await login(2, { role: 'owner' })).response.status).toBe(422);
    expect((await login(2, { branchId: 'sham-shaban' })).response.status).toBe(
      422,
    );
  });
  it('rejects wrong, expired, replayed and forged CAPTCHA', async () => {
    expect((await login(0, { answer: 'wrong' })).response.status).toBe(401);
    const expired = await challenge();
    await CaptchaChallenge.updateOne(
      { _id: expired.challenge.split('.')[0] },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );
    expect((await login(0, expired)).response.status).toBe(401);
    const once = await challenge();
    expect((await login(0, once)).response.status).toBe(200);
    expect((await login(0, once)).response.status).toBe(401);
    expect(
      (await login(0, { challenge: 'forged.signature' })).response.status,
    ).toBe(401);
  });
  it('blocks suspended/deactivated accounts and temporary brute-force lockout', async () => {
    for (const status of ['suspended', 'deactivated']) {
      await User.updateOne(
        { normalizedEmail: fixtures[2]!.email },
        { $set: { accountStatus: status } },
      );
      expect((await login(2)).response.status).toBe(401);
    }
    await User.updateOne(
      { normalizedEmail: fixtures[2]!.email },
      { $set: { accountStatus: 'active', failedLogins: 0 } },
    );
    await LoginAttempt.deleteMany({});
    for (let i = 0; i < 5; i++)
      expect((await login(2, { password: 'wrong' })).response.status).toBe(401);
    expect((await login(2)).response.status).toBe(429);
  }, 15000);
  it('expires access sessions, rotates refresh cookies, detects reuse and rejects revocation/logout', async () => {
    const { agent, response } = await login(0);
    const initial = response.headers['set-cookie'] as unknown as string[];
    const oldRefresh = initial
      .find((v) => v.startsWith('myt_refresh='))!
      .split(';')[0]!;
    const user = await User.findOne({ normalizedEmail: fixtures[0]!.email });
    await UserSession.updateMany(
      { userId: user!._id },
      { $set: { accessExpiresAt: new Date(Date.now() - 1000) } },
    );
    expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
    expect(
      (await agent.post('/api/v1/auth/refresh').set('x-myt-request', '1'))
        .status,
    ).toBe(200);
    expect((await agent.get('/api/v1/auth/me')).status).toBe(200);
    expect(
      (
        await request(app)
          .post('/api/v1/auth/refresh')
          .set('x-myt-request', '1')
          .set('Cookie', oldRefresh)
      ).status,
    ).toBe(401);
    expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
    const again = await login(0);
    expect(
      (await again.agent.post('/api/v1/auth/logout').set('x-myt-request', '1'))
        .status,
    ).toBe(200);
    expect((await again.agent.get('/api/v1/auth/me')).status).toBe(401);
  });
  it('denies CSRF and employees account/grant management', async () => {
    const { agent } = await login(2);
    expect((await agent.post('/api/v1/auth/logout')).status).toBe(403);
    expect((await agent.get('/api/v1/users')).status).toBe(403);
    expect(
      (
        await agent
          .post('/api/v1/users')
          .set('x-myt-request', '1')
          .send(account)
      ).status,
    ).toBe(403);
    expect((await agent.get('/api/v1/security/audit')).status).toBe(403);
    expect((await agent.get('/api/v1/dashboard/comparison')).status).toBe(403);
  });
  it('allows a manager to create only their branch employees and only delegable permissions', async () => {
    const { agent } = await login(1);
    for (const invalid of [
      { role: 'admin', branchId: null },
      { role: 'manager' },
      { branchId: 'sham-aroos' },
      { allow: ['users.manage'] },
    ])
      expect(
        (
          await agent
            .post('/api/v1/users')
            .set('x-myt-request', '1')
            .send({ ...account, ...invalid })
        ).status,
      ).toBe(403);
    const created = await agent
      .post('/api/v1/users')
      .set('x-myt-request', '1')
      .send(account);
    expect(created.status).toBe(201);
    expect(created.body.data).not.toHaveProperty('passwordHash');
    expect(
      (
        await agent
          .post('/api/v1/users')
          .set('x-myt-request', '1')
          .send(account)
      ).status,
    ).toBe(409);
    const listed = await agent.get('/api/v1/users');
    expect(
      listed.body.data.every(
        (u: { role: string; branchIds: string[] }) =>
          u.role === 'employee' && u.branchIds[0] === 'sham-royal',
      ),
    ).toBe(true);
  });
  it('admin account changes and resets revoke sessions; users cannot change their own grants', async () => {
    const admin = await login(0),
      employee = await login(2);
    const users = await admin.agent.get('/api/v1/users');
    const target = users.body.data.find(
      (u: { email: string }) => u.email === fixtures[2]!.email,
    );
    const { email, ...unused } = target;
    void unused;
    const data = {
      name: target.name,
      email,
      role: target.role,
      branchId: target.assignedBranchId,
      allow: [],
      deny: ['customers.read'],
      accountStatus: 'active',
      language: 'en',
      expectedVersion: target.grantVersion,
    };
    expect(
      (
        await admin.agent
          .patch(`/api/v1/users/${target._id}`)
          .set('x-myt-request', '1')
          .send(data)
      ).status,
    ).toBe(200);
    expect((await employee.agent.get('/api/v1/auth/me')).status).toBe(401);
    const again = await login(2);
    expect(
      (await again.agent.get('/api/v1/branches/sham-royal/customers')).status,
    ).toBe(403);
    expect(
      (
        await admin.agent
          .post(`/api/v1/users/${target._id}/password`)
          .set('x-myt-request', '1')
          .send({ password })
      ).status,
    ).toBe(200);
    expect((await again.agent.get('/api/v1/auth/me')).status).toBe(401);
    const self = users.body.data.find(
      (u: { role: string }) => u.role === 'admin',
    );
    expect(
      (
        await admin.agent
          .patch(`/api/v1/users/${self._id}`)
          .set('x-myt-request', '1')
          .send({
            ...data,
            name: self.name,
            email: self.email,
            role: 'admin',
            branchId: null,
            expectedVersion: self.grantVersion,
          })
      ).status,
    ).toBe(403);
  });
  it('does not delegate permissions through employee defaults or catalog expansion', async () => {
    const manager = await User.findOne({ normalizedEmail: fixtures[1]!.email });
    await User.updateOne(
      { _id: manager!._id },
      { $set: { deny: ['customers.write', 'products.update'] } },
    );
    try {
      const { agent } = await login(1);
      for (const overrides of [
        { allow: [], deny: [] },
        { allow: ['catalog.write'], deny: ['customers.write'] },
      ]) {
        const response = await agent
          .post('/api/v1/users')
          .set('x-myt-request', '1')
          .send({ ...account, email: 'ceiling@test.local', ...overrides });
        expect(response.status).toBe(403);
        expect(response.body.error.message).toBe('delegation_denied');
      }
      expect(
        await User.exists({ normalizedEmail: 'ceiling@test.local' }),
      ).toBeNull();
    } finally {
      await User.updateOne({ _id: manager!._id }, { $set: { deny: [] } });
    }
  });
  it('restricts global session management when an admin permission is denied', async () => {
    const admin = await User.findOne({ normalizedEmail: fixtures[0]!.email });
    await User.updateOne(
      { _id: admin!._id },
      { $set: { deny: ['sessions.manage'] } },
    );
    try {
      const employee = await login(2);
      const own = await employee.agent.get('/api/v1/sessions');
      const { agent } = await login(0);
      const listed = await agent.get('/api/v1/sessions');
      expect(
        listed.body.data.every(
          (s: { userId: string }) => s.userId === admin!._id,
        ),
      ).toBe(true);
      expect(
        (
          await agent
            .delete(`/api/v1/sessions/${own.body.data[0]._id}`)
            .set('x-myt-request', '1')
        ).status,
      ).toBe(404);
    } finally {
      await User.updateOne({ _id: admin!._id }, { $set: { deny: [] } });
    }
  });
  it('persists safe security events and supports own/admin session listing and revocation', async () => {
    const { agent } = await login(0);
    const sessions = await agent.get('/api/v1/sessions');
    expect(sessions.status).toBe(200);
    expect(JSON.stringify(sessions.body)).not.toMatch(/Hash/);
    expect(
      (
        await agent
          .delete(`/api/v1/sessions/${sessions.body.data.at(-1)._id}`)
          .set('x-myt-request', '1')
      ).status,
    ).toBe(200);
    const events = await SecurityAuditLog.find().lean();
    expect(events.some((e) => e.action === 'login.success')).toBe(true);
    expect(events.some((e) => e.action === 'login.failed')).toBe(true);
    expect(JSON.stringify(events)).not.toContain(password);
    expect(JSON.stringify(events)).not.toMatch(
      /answerHash|refreshHash|passwordHash/,
    );
  });
});
