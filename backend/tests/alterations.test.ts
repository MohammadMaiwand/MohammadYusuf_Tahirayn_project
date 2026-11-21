import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import {
  branches,
  permissions,
  rolePermissions,
  calendarDay,
  alterationDuration,
  type Command,
  type SessionIdentity,
} from '@myt/shared';
import { createApp } from '../src/app.js';
import { parseEnv } from '../src/config/env.js';
import { initializeDatabase } from '../src/database/bootstrap.js';
import { migrateClothing } from '../src/database/clothingMigration.js';
import { migrateAlterations } from '../src/database/alterationsMigration.js';
import {
  Alteration,
  type AlterationRecord,
} from '../src/modules/alterations/model.js';
import { reconcileAlterations } from '../src/modules/alterations/scheduler.js';
import { alterationDetail } from '../src/modules/alterations/service.js';
import { context } from '../src/security/identity.js';
import { executeCommand } from '../src/services/commands.js';
import {
  Customer,
  Transaction,
  Notification,
  AuditLog,
  type CustomerRecord,
} from '../src/database/models.js';
import { report } from '../src/modules/reports/service.js';
import { listQuery } from '../src/validators/query.js';
const database = `myt_test_${randomUUID().replaceAll('-', '')}`;
const uri =
  process.env.MYT_TEST_MONGODB_URI ||
  'mongodb://127.0.0.1:27018/?replicaSet=myt-dev';
if (!/^mongodb:\/\/(127\.0\.0\.1|localhost):\d+\//.test(uri))
  throw new Error('Local fixture database required');
const active = branches.filter((row) => row.active).map((row) => row.id);
const admin: SessionIdentity = {
  subject: randomUUID(),
  name: 'Alteration admin',
  role: 'admin',
  branchIds: active,
  permissions: [...permissions],
  development: true,
  language: 'en',
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
};
const manager: SessionIdentity = {
  ...admin,
  subject: randomUUID(),
  role: 'manager',
  branchIds: ['sham-royal'],
  permissions: [...rolePermissions.manager],
};
const employee: SessionIdentity = {
  ...admin,
  subject: randomUUID(),
  role: 'employee',
  branchIds: ['sham-royal'],
  permissions: [...rolePermissions.employee],
};
const other: SessionIdentity = { ...employee, subject: randomUUID() };
const noMoney: SessionIdentity = {
  ...employee,
  permissions: employee.permissions.filter(
    (p) => p !== 'alterations.financial',
  ),
};
const fixtureActors: Record<string, SessionIdentity> = {
  manager,
  employee,
  other,
  noMoney,
  admin,
};
const app = createApp(
  parseEnv({
    NODE_ENV: 'test',
    MONGODB_URI: uri,
    LOG_LEVEL: 'silent',
    RATE_LIMIT_MAX: '10000',
  }),
  () => true,
  async (req) => fixtureActors[req.get('x-actor') || 'admin']!,
);
const deviceId = randomUUID();
const command = (
  action: Command['action'],
  data: unknown,
  options: Partial<Command> = {},
): Command => ({
  action,
  data,
  operationId: randomUUID(),
  deviceId,
  ...options,
});
const run = (input: Command, actor = admin, branch = 'sham-royal') =>
  executeCommand(context(actor, branch), input);
const start = new Date(calendarDay(new Date()) * 86400000 - 16200000);
const date = (offset: number, hours = 0) =>
  new Date(start.getTime() + offset * 86400000 + hours * 3600000);
let customer: CustomerRecord, record: AlterationRecord;
const data = (customerId: string, garmentId = randomUUID()) => ({
  customerId,
  garmentId,
  garmentName: 'Fixture dress',
  garmentType: 'Bridal',
  brand: 'Fixture',
  color: 'Green',
  alterationType: 'waist',
  description: 'Adjust waist with original material',
  originalPrice: '15000',
  alterationPrice: '250',
  currency: 'AFN',
  tailorName: 'Tailor fixture',
  startAt: start.toISOString(),
  expectedAt: date(2).toISOString(),
  notes: '',
});
beforeAll(async () => {
  await mongoose.connect(uri, {
    dbName: database,
    autoIndex: false,
    autoCreate: false,
  });
  await initializeDatabase();
  await migrateClothing();
  await migrateAlterations();
  await migrateAlterations();
  for (const actor of [admin, manager, employee, other])
    for (const branch of actor.branchIds)
      await run(
        command('device.register', { label: 'Alteration fixture' }),
        actor,
        branch,
      );
  customer = (await run(
    command('customer.create', {
      fullName: 'Alteration customer',
      telephone: '0701111111',
      whatsapp: '0702222222',
    }),
  )) as CustomerRecord;
}, 30000);
afterAll(async () => {
  if (
    mongoose.connection.name !== database ||
    !/^myt_test_[a-f0-9]{32}$/.test(database)
  )
    throw new Error('Unsafe cleanup refused');
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}, 30000);
describe('branch-isolated garment alterations', () => {
  it('creates manual IDs, snapshots the existing customer, calculates calendar days and replays once', async () => {
    const cmd = command('alteration.create', data(customer._id, 'MANUAL-001'));
    record = (await run(cmd, employee)) as AlterationRecord;
    expect(record).toMatchObject({
      garmentId: 'MANUAL-001',
      customerId: customer._id,
      customerName: customer.fullName,
      telephone: customer.telephone,
      whatsapp: customer.whatsapp,
      originalMinor: 1500000,
      alterationMinor: 25000,
      durationDays: 2,
      status: 'pending',
      createdBy: employee.subject,
    });
    expect(((await run(cmd, employee)) as AlterationRecord)._id).toBe(
      record._id,
    );
    const redactedReplay = (await run(cmd, noMoney)) as AlterationRecord;
    expect(redactedReplay._id).toBe(record._id);
    expect(redactedReplay.alterationMinor).toBeUndefined();
    expect(await Customer.countDocuments()).toBe(1);
    expect(await Alteration.countDocuments()).toBe(1);
    await expect(
      run(
        command('alteration.create', data(customer._id, 'manual-001')),
        employee,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      alterationDuration(
        '2026-11-20T23:59:00+04:30',
        '2026-11-21T00:00:00+04:30',
      ),
    ).toBe(1);
    const invalid = {
      ...data(customer._id),
      expectedAt: date(-1).toISOString(),
    };
    expect(
      (
        await request(app)
          .post('/api/v1/branches/sham-royal/commands')
          .send(command('alteration.create', invalid))
      ).status,
    ).toBe(422);
    expect(await Alteration.countDocuments()).toBe(1);
  });
  it('enforces every read/write/receipt branch and own-record predicate, including financial redaction and replay', async () => {
    for (const suffix of ['', '/receipt']) {
      expect(
        (
          await request(app).get(
            `/api/v1/branches/sham-aroos/alterations/${record._id}${suffix}`,
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await request(app)
            .get(
              `/api/v1/branches/sham-royal/alterations/${record._id}${suffix}`,
            )
            .set('x-actor', 'other')
        ).status,
      ).toBe(404);
    }
    expect(
      (await request(app).get('/api/v1/branches/sham-shaban/alterations'))
        .status,
    ).toBe(403);
    const hidden = await request(app)
      .get(`/api/v1/branches/sham-royal/alterations/${record._id}`)
      .set('x-actor', 'noMoney');
    expect(hidden.status).toBe(200);
    expect(hidden.body.data.originalMinor).toBeUndefined();
    expect(hidden.body.data.alterationMinor).toBeUndefined();
    const listed = await request(app)
      .get('/api/v1/branches/sham-royal/alterations')
      .set('x-actor', 'other');
    expect(listed.body.data.total).toBe(0);
    await expect(
      run(
        command(
          'alteration.status',
          { status: 'ready', expectedVersion: record.version },
          { targetId: record._id },
        ),
        other,
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      run(
        command('alteration.update', data(customer._id), {
          targetId: record._id,
          expectedVersion: record.version,
        }),
        admin,
        'sham-aroos',
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      run(
        command('alteration.create', data(customer._id)),
        admin,
        'sham-aroos',
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      (
        await request(app)
          .get(`/api/v1/branches/sham-aroos/alterations/${record._id}`)
          .set('x-actor', 'manager')
      ).status,
    ).toBe(403);
  });
  it('edits only mutable fields, prevents stale writes and never overwrites original price or currency', async () => {
    const updated = (await run(
      command(
        'alteration.update',
        {
          ...data(customer._id, record.garmentId),
          alterationPrice: '300',
          description: 'Updated adjustment',
        },
        { targetId: record._id, expectedVersion: record.version },
      ),
      employee,
    )) as AlterationRecord;
    expect(updated).toMatchObject({
      originalMinor: 1500000,
      alterationMinor: 30000,
      version: 2,
      durationDays: 2,
    });
    record = updated;
    await expect(
      run(
        command(
          'alteration.update',
          { ...data(customer._id, record.garmentId), originalPrice: '1' },
          { targetId: record._id, expectedVersion: record.version },
        ),
        employee,
      ),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      run(
        command(
          'alteration.update',
          { ...data(customer._id, record.garmentId), currency: 'USD' },
          { targetId: record._id, expectedVersion: record.version },
        ),
        employee,
      ),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      run(
        command(
          'alteration.status',
          { status: 'ready', expectedVersion: 1 },
          { targetId: record._id },
        ),
        employee,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      await AuditLog.countDocuments({
        resource: 'alterations',
        recordId: record._id,
      }),
    ).toBe(2);
  });
  it('accepts independent AFN/USD records in every active branch and reports charges without altering sales or cash', async () => {
    for (const branch of active) {
      const c = (await run(
        command('customer.create', {
          fullName: 'Scoped customer ' + branch,
          telephone: '0700000000',
        }),
        admin,
        branch,
      )) as CustomerRecord;
      for (const currency of ['AFN', 'USD']) {
        const row = (await run(
          command('alteration.create', {
            ...data(c._id, 'SHARED-MANUAL-' + currency),
            currency,
            alterationPrice: currency === 'USD' ? '10' : '500',
          }),
          admin,
          branch,
        )) as AlterationRecord;
        expect(row.currency).toBe(currency);
        const summary = await report(
          context(admin, branch),
          listQuery.parse({ customerId: c._id, currency }),
        );
        expect(summary.alterationChargesMinor).toBe(
          currency === 'USD' ? '1000' : '50000',
        );
        expect(Number(summary.totals.agreedMinor)).toBe(0);
        expect(Number(summary.collectedMinor)).toBe(0);
        const result = await request(app).get(
          `/api/v1/branches/${branch}/alterations?customerId=${c._id}&currency=${currency}&tailor=Tailor&garmentId=SHARED&limit=1&page=1`,
        );
        expect(result.body.data.total).toBe(1);
        expect(result.body.data.items[0]._id).toBe(row._id);
      }
    }
    expect(await Transaction.countDocuments()).toBe(0);
  });
  it('securely processes optional images, scopes blobs, rejects malformed/unsupported images, and supports removal', async () => {
    const photo = await sharp({
      create: { width: 20, height: 20, channels: 3, background: '#216b53' },
    })
      .png()
      .toBuffer();
    const upload = await request(app)
      .post('/api/v1/branches/sham-royal/clothing-photos?purpose=alteration')
      .set('x-actor', 'employee')
      .send({ data: photo.toString('base64') });
    expect(upload.status).toBe(201);
    const id = upload.body.data.photoId;
    expect(
      (
        await request(app).get(
          `/api/v1/branches/sham-aroos/clothing-photos/${id}`,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .get(`/api/v1/branches/sham-royal/clothing-photos/${id}`)
          .set('x-actor', 'other')
      ).status,
    ).toBe(404);
    const edited = (await run(
      command(
        'alteration.update',
        { ...data(customer._id, record.garmentId), photoId: id },
        { targetId: record._id, expectedVersion: record.version },
      ),
      employee,
    )) as AlterationRecord;
    record = edited;
    expect(
      (
        await request(app)
          .get(`/api/v1/branches/sham-royal/clothing-photos/${id}`)
          .set('x-actor', 'manager')
      ).headers['content-type'],
    ).toContain('image/webp');
    record = (await run(
      command(
        'alteration.update',
        { ...data(customer._id, record.garmentId), photoId: null },
        { targetId: record._id, expectedVersion: record.version },
      ),
      employee,
    )) as AlterationRecord;
    expect(record.photoId).toBeNull();
    expect(
      (
        await request(app)
          .post(
            '/api/v1/branches/sham-royal/clothing-photos?purpose=alteration',
          )
          .set('x-actor', 'employee')
          .send({ data: Buffer.from('<svg/>').toString('base64') })
      ).status,
    ).toBe(422);
  });
});
describe('durable Kabul delivery reminders', () => {
  it('generates once on the prior Kabul day, persists status, and targets only authorized branch management', async () => {
    await reconcileAlterations(date(0, 23));
    expect(
      await Notification.countDocuments({ alterationId: record._id }),
    ).toBe(0);
    await Promise.all([
      reconcileAlterations(date(1)),
      reconcileAlterations(date(1)),
    ]);
    await reconcileAlterations(date(1, 23));
    const reminders = await Notification.find({
      alterationId: record._id,
    }).lean();
    expect(reminders).toHaveLength(1);
    expect(reminders[0]).toMatchObject({
      garmentId: record.garmentId,
      customerName: customer.fullName,
      branchId: 'sham-royal',
      managementOnly: true,
      deliveryStatus: 'available',
      resolved: false,
    });
    const managerInbox = await request(app)
      .get('/api/v1/branches/sham-royal/notifications')
      .set('x-actor', 'manager');
    expect(
      managerInbox.body.data.items.some(
        (row: { _id: string }) => row._id === reminders[0]!._id,
      ),
    ).toBe(true);
    const employeeInbox = await request(app)
      .get('/api/v1/branches/sham-royal/notifications')
      .set('x-actor', 'employee');
    expect(
      employeeInbox.body.data.items.some(
        (row: { alterationId?: string }) => !!row.alterationId,
      ),
    ).toBe(false);
    const otherBranch = await request(app).get(
      '/api/v1/branches/sham-aroos/notifications',
    );
    expect(
      otherBranch.body.data.items.some(
        (row: { alterationId?: string }) => row.alterationId === record._id,
      ),
    ).toBe(false);
    const all = await request(app).get('/api/v1/notifications/global');
    expect(
      all.body.data.some(
        (row: { alterationId?: string }) => row.alterationId === record._id,
      ),
    ).toBe(true);
    await expect(
      run(
        command(
          'notification.read',
          { read: true },
          { targetId: reminders[0]!._id },
        ),
        employee,
      ),
    ).rejects.toMatchObject({ status: 404 });
    await run(
      command(
        'notification.read',
        { read: true },
        { targetId: reminders[0]!._id },
      ),
      manager,
    );
    await reconcileAlterations(date(1));
    const saved = await Notification.findById(reminders[0]!._id).lean();
    expect(saved!.readBy).toEqual([manager.subject]);
  });
  it('reschedules safely, resolves stale reminders, marks overdue and audits without changing financial values', async () => {
    const current = await Alteration.findById(record._id).lean();
    record = (await run(
      command(
        'alteration.update',
        {
          ...data(customer._id, record.garmentId),
          expectedAt: date(5).toISOString(),
        },
        { targetId: record._id, expectedVersion: current!.version },
      ),
      employee,
    )) as AlterationRecord;
    expect(
      await Notification.countDocuments({
        alterationId: record._id,
        resolved: false,
      }),
    ).toBe(0);
    await reconcileAlterations(date(4));
    await reconcileAlterations(date(4));
    expect(
      await Notification.countDocuments({
        alterationId: record._id,
        resolved: false,
      }),
    ).toBe(1);
    await reconcileAlterations(date(6));
    const overdue = await Alteration.findById(record._id).lean();
    expect(overdue).toMatchObject({
      status: 'overdue',
      originalMinor: 1500000,
      alterationMinor: 25000,
    });
    expect(
      await Notification.countDocuments({
        alterationId: record._id,
        resolved: false,
      }),
    ).toBe(0);
    expect(
      await AuditLog.countDocuments({
        recordId: record._id,
        action: 'alteration.overdue',
      }),
    ).toBe(1);
    await run(
      command(
        'alteration.status',
        { status: 'delivered', expectedVersion: overdue!.version },
        { targetId: record._id },
      ),
      employee,
    );
    const delivered = await Alteration.findById(record._id).lean();
    await expect(
      run(
        command('alteration.update', data(customer._id), {
          targetId: record._id,
          expectedVersion: delivered!.version,
        }),
        employee,
      ),
    ).rejects.toMatchObject({ status: 422 });
    await reconcileAlterations(date(7));
    expect((await Alteration.findById(record._id))!.status).toBe('delivered');
  });
  it('does not remind completed or cancelled jobs and refuses notification/read/print permissions', async () => {
    for (const status of ['ready', 'cancelled', 'delivered'] as const) {
      const row = (await run(
        command('alteration.create', data(customer._id)),
        employee,
      )) as AlterationRecord;
      await run(
        command(
          'alteration.status',
          { status, expectedVersion: row.version },
          { targetId: row._id },
        ),
        employee,
      );
      await reconcileAlterations(date(1));
      expect(await Notification.countDocuments({ alterationId: row._id })).toBe(
        0,
      );
    }
    const actor = {
      ...employee,
      permissions: employee.permissions.filter(
        (p) => p !== 'alterations.print',
      ),
    };
    await expect(
      alterationDetail(context(actor, 'sham-royal'), record._id, true),
    ).rejects.toMatchObject({ status: 403 });
    const denied = {
      ...employee,
      permissions: employee.permissions.filter(
        (p) => p !== 'alterations.status',
      ),
    };
    await expect(
      run(
        command(
          'alteration.status',
          { status: 'pending', expectedVersion: 1 },
          { targetId: record._id },
        ),
        denied,
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
});
