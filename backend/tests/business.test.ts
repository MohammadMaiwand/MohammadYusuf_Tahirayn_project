import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import {
  permissions,
  rolePermissions,
  branches,
  type Command,
  type SessionIdentity,
} from '@myt/shared';
import { parseEnv } from '../src/config/env.js';
import { createApp } from '../src/app.js';
import { initializeDatabase } from '../src/database/bootstrap.js';
import { context } from '../src/security/identity.js';
import { executeCommand } from '../src/services/commands.js';
import {
  Transaction,
  Customer,
  Payment,
  Invoice,
  Notification,
  AuditLog,
  Branch,
  BranchSettings,
  Expense,
  type TransactionRecord,
  type CatalogRecord,
  type CustomerRecord,
} from '../src/database/models.js';
import { kabulDay, reconcileNotifications } from '../src/jobs/notifications.js';
import { report } from '../src/modules/reports/service.js';
import { listQuery } from '../src/validators/query.js';
import { migrateClothing } from '../src/database/clothingMigration.js';
import sharp from 'sharp';
import { migrateOperations } from '../src/database/operationsMigration.js';
import { migrateAlterations } from '../src/database/alterationsMigration.js';
import { migrateCurrency } from '../src/database/currencyMigration.js';
import { customerDetail } from '../src/services/queries.js';
import { migrateExpenses } from '../src/database/expensesMigration.js';
import {
  Advertisement,
  AdvertisementImage,
} from '../src/modules/advertisements/model.js';
import { migrateAdvertisements } from '../src/database/advertisementsMigration.js';

const database = `myt_test_${randomUUID().replaceAll('-', '')}`;
const uri =
  process.env.MYT_TEST_MONGODB_URI ||
  'mongodb://127.0.0.1:27018/?replicaSet=myt-dev';
if (!/^mongodb:\/\/(127\.0\.0\.1|localhost):\d+\//.test(uri))
  throw new Error('Integration tests require an explicitly local MongoDB URI');
const admin: SessionIdentity = {
  subject: randomUUID(),
  name: 'Test administrator',
  role: 'admin',
  permissions: [...permissions],
  branchIds: branches.filter((b) => b.active).map((b) => b.id),
  development: true,
  language: 'en',
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
};
const user: SessionIdentity = {
  ...admin,
  subject: randomUUID(),
  name: 'Test operator',
  role: 'employee',
  permissions: [...rolePermissions.employee],
  branchIds: ['sham-royal'],
};
const manager: SessionIdentity = {
  ...admin,
  subject: randomUUID(),
  name: 'Test branch manager',
  role: 'manager',
  permissions: [...rolePermissions.manager],
  branchIds: ['sham-royal'],
};
const otherManager: SessionIdentity = {
  ...manager,
  subject: randomUUID(),
  name: 'Test other branch manager',
  branchIds: ['sham-aroos'],
};
const deviceId = randomUUID();
const env = parseEnv({
  NODE_ENV: 'test',
  MONGODB_URI: uri,
  LOG_LEVEL: 'silent',
  OFFLINE_SYNC_ENABLED: 'true',
});
const app = createApp(
  env,
  () => true,
  async (req) => {
    const fixture = req.get('x-test-fixture');
    if (fixture === 'no-expenses')
      return {
        ...admin,
        permissions: admin.permissions.filter(
          (p) => !p.startsWith('expenses.'),
        ),
      };
    if (fixture === 'employee') return user;
    if (fixture === 'manager') return manager;
    if (fixture === 'manager-aroos') return otherManager;
    return admin;
  },
);
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
const run = (
  cmd: Command,
  actor = admin,
  branch = 'sham-royal',
  offline = false,
) => executeCommand(context(actor, branch), cmd, offline);
let product: CatalogRecord,
  customer: CustomerRecord,
  transaction: TransactionRecord;
beforeAll(async () => {
  await mongoose.connect(uri, { dbName: database });
  await initializeDatabase();
  await migrateAdvertisements();
  await migrateAdvertisements();
  await migrateClothing();
  await migrateClothing();
  await migrateExpenses();
  await migrateAlterations();
  await migrateAlterations();
  await migrateExpenses(); // Additive migration is safe to rerun.
  await migrateOperations();
  await migrateOperations();
  for (const branch of admin.branchIds)
    await run(
      command('device.register', { label: 'Integration test device' }),
      admin,
      branch,
    );
  await run(
    command('device.register', { label: 'Operator test device' }),
    user,
  );
}, 30000);
afterAll(async () => {
  if (
    mongoose.connection.name !== database ||
    !database.startsWith('myt_test_')
  )
    throw new Error('Unsafe test database cleanup refused');
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}, 30000);
describe('real MongoDB business integration', () => {
  it('serves ad images cross-origin and scopes manager ad management to one branch', async () => {
    const global = await request(app).post('/api/v1/advertisements').send({
      title: 'Company announcement',
      active: true,
    });
    expect(global.status).toBe(201);
    expect(global.body.data.branchId).toBeNull();

    const image = await sharp({
      create: {
        width: 8,
        height: 8,
        channels: 3,
        background: { r: 20, g: 100, b: 80 },
      },
    })
      .png()
      .toBuffer();
    const uploaded = await request(app)
      .post('/api/v1/advertisements/photos')
      .set('x-test-fixture', 'manager')
      .send({ data: image.toString('base64') });
    expect(uploaded.status).toBe(201);
    const photoId = uploaded.body.data.photoId as string;

    const own = await request(app)
      .post('/api/v1/advertisements')
      .set('x-test-fixture', 'manager')
      .send({ title: 'Royal branch offer', photoId });
    expect(own.status).toBe(201);
    expect(own.body.data.branchId).toBe('sham-royal');

    const crossBranchPhoto = await request(app)
      .post('/api/v1/advertisements')
      .set('x-test-fixture', 'manager-aroos')
      .send({ title: 'Invalid photo reuse', photoId });
    expect(crossBranchPhoto.status).toBe(422);
    const other = await request(app)
      .post('/api/v1/advertisements')
      .set('x-test-fixture', 'manager-aroos')
      .send({ title: 'Aroos branch offer' });
    expect(other.status).toBe(201);
    expect(other.body.data.branchId).toBe('sham-aroos');

    const managerList = await request(app)
      .get('/api/v1/advertisements')
      .set('x-test-fixture', 'manager');
    expect(managerList.status).toBe(200);
    expect(managerList.body.data.map((ad: { _id: string }) => ad._id)).toEqual([
      own.body.data._id,
    ]);
    const adminList = await request(app).get('/api/v1/advertisements');
    expect(adminList.body.data).toHaveLength(3);
    expect(
      (
        await request(app)
          .get('/api/v1/advertisements')
          .set('x-test-fixture', 'employee')
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .patch(`/api/v1/advertisements/${other.body.data._id}`)
          .set('x-test-fixture', 'manager')
          .send({ title: 'Changed', photoId: null })
      ).status,
    ).toBe(404);
    const globalEdit = await request(app)
      .patch(`/api/v1/advertisements/${global.body.data._id}`)
      .set('x-test-fixture', 'manager')
      .send({ title: 'Changed global ad' });
    expect(globalEdit.status).toBe(404);

    const servedImage = await request(app).get(
      `/api/v1/public/advertisements/${photoId}/image`,
    );
    expect(servedImage.status).toBe(200);
    expect(servedImage.headers['cross-origin-resource-policy']).toBe(
      'cross-origin',
    );
    expect(servedImage.headers['content-type']).toContain('image/webp');
    expect(servedImage.body.length).toBeGreaterThan(0);

    const publicList = await request(app).get('/api/v1/public/advertisements');
    expect(publicList.status).toBe(200);
    expect(publicList.body.data.map((ad: { _id: string }) => ad._id)).toEqual(
      expect.arrayContaining([
        global.body.data._id,
        own.body.data._id,
        other.body.data._id,
      ]),
    );
    expect(
      await Advertisement.countDocuments({
        _id: { $in: [global.body.data._id, own.body.data._id] },
      }),
    ).toBe(2);
    expect(await AdvertisementImage.exists({ _id: photoId })).not.toBeNull();
    const removed = await request(app)
      .delete(`/api/v1/advertisements/${own.body.data._id}`)
      .set('x-test-fixture', 'manager');
    expect(removed.status).toBe(200);
    const unreferencedImage = await request(app).get(
      `/api/v1/public/advertisements/${photoId}/image`,
    );
    expect(unreferencedImage.status).toBe(404);
  });

  it('records exact expenses in separate tables for all three active branches and replays once', async () => {
    for (const branch of admin.branchIds) {
      const cmd = command('expense.create', {
        name: `Expense ${branch}`,
        amount: '123.45',
        expenseAt: '2026-11-13T00:00:00+04:30',
        spentBy: 'Expense fixture',
        description: 'Office supplies',
      });
      const result = (await run(cmd, admin, branch)) as {
        _id: string;
        amountMinor: number;
      };
      expect(result.amountMinor).toBe(12345);
      expect(((await run(cmd, admin, branch)) as typeof result)._id).toBe(
        result._id,
      );
      const listed = await request(app).get(
        `/api/v1/branches/${branch}/expenses`,
      );
      expect(listed.status).toBe(200);
      expect(listed.headers['cache-control']).toBe('no-store');
      expect(listed.body.data.total).toBe(1);
      expect(listed.body.data.items[0]).toMatchObject({
        branchId: branch,
        name: `Expense ${branch}`,
        spentBy: 'Expense fixture',
        amountMinor: 12345,
        description: 'Office supplies',
      });
      expect(await Expense.countDocuments({ branchId: branch })).toBe(1);
      const audit = await AuditLog.findOne({
        branchId: branch,
        resource: 'expenses',
        recordId: result._id,
      });
      expect(audit).not.toBeNull();
    }
  });
  it('denies cross-branch expense reads/writes, disabled branches and missing permissions', async () => {
    const data = {
      name: 'Denied expense',
      amount: '1',
      expenseAt: new Date().toISOString(),
      spentBy: 'Fixture',
      description: '',
    };
    for (const branch of ['sham-aroos', 'sham-shaban']) {
      expect(
        (
          await request(app)
            .get(`/api/v1/branches/${branch}/expenses`)
            .set('x-test-fixture', 'employee')
        ).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .post(`/api/v1/branches/${branch}/commands`)
            .set('x-test-fixture', 'employee')
            .send(command('expense.create', data))
        ).status,
      ).toBe(403);
    }
    expect(
      (
        await request(app).get(
          '/api/v1/branches/sham-royal/expenses?q=Expense%20sham-aroos',
        )
      ).body.data.total,
    ).toBe(0);
    expect(
      (
        await request(app)
          .get('/api/v1/branches/sham-royal/expenses')
          .set('x-test-fixture', 'no-expenses')
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post('/api/v1/branches/sham-royal/commands')
          .set('x-test-fixture', 'no-expenses')
          .send(command('expense.create', data))
      ).status,
    ).toBe(403);
    expect(
      (
        await request(createApp(env)).get(
          '/api/v1/branches/sham-royal/expenses',
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await request(createApp(env))
          .post('/api/v1/branches/sham-royal/commands')
          .send(command('expense.create', data))
      ).status,
    ).toBe(401);
    await expect(
      run(command('expense.create', data), admin, 'sham-royal', true),
    ).rejects.toThrow('offline_action_denied');
    expect(await Expense.countDocuments({ name: 'Denied expense' })).toBe(0);
  });
  it('rejects invalid expense amounts/dates and client-supplied branch scope without side effects', async () => {
    const data = {
      name: 'Invalid expense',
      amount: '1',
      expenseAt: new Date().toISOString(),
      spentBy: 'Fixture',
      description: '',
    };
    const before = await Expense.countDocuments();
    for (const invalid of [
      { amount: '0' },
      { amount: '-1' },
      { amount: '1.001' },
      { expenseAt: 'invalid' },
      { name: '' },
      { spentBy: '' },
      { branchId: 'sham-aroos' },
    ]) {
      expect(
        (
          await request(app)
            .post('/api/v1/branches/sham-royal/commands')
            .send(command('expense.create', { ...data, ...invalid }))
        ).status,
      ).toBe(422);
    }
    expect(await Expense.countDocuments()).toBe(before);
  });
  it('initializes exactly four active branches with no default user accounts', async () => {
    expect(await Branch.countDocuments()).toBe(4);
    expect(await Branch.findById('sham-shaban')).toBeNull();
    const { User } = await import('../src/database/models.js');
    expect(await User.countDocuments()).toBe(0);
  });
  it('creates branch-scoped products and reusable customer profiles', async () => {
    product = (await run(
      command(
        'catalog.create',
        {
          name: 'Royal dress',
          clothingId: 'SR-001',
          price: '1000.25',
          productType: 'Clothing',
          brand: 'Test',
          color: 'Blue',
        },
        { resource: 'products' },
      ),
    )) as CatalogRecord;
    customer = (await run(
      command('customer.create', {
        fullName: 'Customer fixture',
        telephone: '0700000000',
      }),
    )) as CustomerRecord;
    expect(product.priceMinor).toBe(100025);
    expect(customer.code).toContain(customer._id.toUpperCase());
    const response = await request(app).get(
      '/api/v1/branches/sham-royal/products?q=Royal',
    );
    expect(response.status).toBe(200);
    expect(response.body.data.items[0]._id).toBe(product._id);
  });
  it('records advance once as a payment and computes purchase balances exactly', async () => {
    transaction = (await run(
      command('transaction.create', {
        customerId: customer._id,
        productId: product._id,
        type: 'purchase',
        agreedPrice: '1000.25',
        advance: '100.10',
        reservationAt: new Date(Date.now() + 86400000).toISOString(),
      }),
    )) as TransactionRecord;
    expect(transaction.totalMinor - transaction.paidMinor).toBe(90015);
    const payments = await Payment.find({ transactionId: transaction._id });
    expect(payments).toHaveLength(1);
    expect(payments[0]!.amountMinor).toBe(10010);
    expect(payments[0]!.origin).toBe('advance');
    expect(transaction.product.clothingId).toBe('SR-001');
  });
  it('requires manual IDs, isolates uniqueness by branch and preserves legacy records', async () => {
    await expect(
      run(
        command(
          'catalog.create',
          { name: 'Missing ID' },
          { resource: 'products' },
        ),
      ),
    ).rejects.toThrow('clothing_id_required');
    await expect(
      run(
        command(
          'catalog.create',
          { name: 'Duplicate', clothingId: 'sr-001' },
          { resource: 'products' },
        ),
      ),
    ).rejects.toThrow('duplicate_record');
    for (const branchId of ['sham-aroos', 'sham-aroos-vip']) {
      const result = (await run(
        command(
          'catalog.create',
          { name: 'Other branch', clothingId: 'sr-001' },
          { resource: 'products' },
        ),
        admin,
        branchId,
      )) as CatalogRecord;
      expect(result.clothingId).toBe('SR-001');
      const search = await request(app).get(
        `/api/v1/branches/${branchId}/products?q=sr-001`,
      );
      expect(
        search.body.data.items.map((row: CatalogRecord) => row._id),
      ).toEqual([result._id]);
    }
    const { catalogModels } = await import('../src/database/models.js');
    const legacy = await catalogModels.products.create({
      _id: randomUUID(),
      branchId: 'sham-royal',
      code: 'LEGACY',
      createdBy: admin.subject,
      name: 'Legacy',
      normalizedName: 'legacy',
      priceMinor: 0,
      quantity: 1,
      status: 'active',
    });
    const updated = (await run(
      command(
        'catalog.update',
        { name: 'Legacy', clothingId: 'LEG-01' },
        { resource: 'products', targetId: legacy._id, expectedVersion: 1 },
      ),
    )) as CatalogRecord;
    expect(updated._id).toBe(legacy._id);
    expect(updated.clothingId).toBe('LEG-01');
    await expect(
      run(
        command(
          'catalog.update',
          { name: 'Legacy', clothingId: 'SR-001' },
          { resource: 'products', targetId: legacy._id, expectedVersion: 2 },
        ),
      ),
    ).rejects.toThrow('duplicate_record');
    await expect(
      run(
        command(
          'catalog.update',
          { name: 'Stolen', clothingId: 'X-01' },
          { resource: 'products', targetId: legacy._id, expectedVersion: 2 },
        ),
        admin,
        'sham-aroos',
      ),
    ).rejects.toThrow();
  });
  it('validates, optimizes and protects immutable clothing photos across branches', async () => {
    const anonymousApp = createApp(env);
    expect(
      (
        await request(anonymousApp).get(
          `/api/v1/branches/sham-royal/clothing-photos/${randomUUID()}`,
        )
      ).status,
    ).toBe(401);
    const png = await sharp({
      create: { width: 1100, height: 1300, channels: 3, background: 'blue' },
    })
      .png()
      .toBuffer();
    for (const branchId of admin.branchIds) {
      const root = `/api/v1/branches/${branchId}/clothing-photos`;
      const uploaded = await request(app)
        .post(root)
        .send({ data: png.toString('base64') });
      expect(uploaded.status).toBe(201);
      const id = uploaded.body.data.photoId;
      const read = await request(app).get(`${root}/${id}`);
      expect(read.status).toBe(200);
      expect(read.headers['cache-control']).toBe('private, no-store');
      const metadata = await sharp(read.body).metadata();
      expect(metadata.format).toBe('webp');
      expect(metadata.height).toBeLessThanOrEqual(1000);
      const linked = (await run(
        command(
          'catalog.create',
          { name: 'Photo dress', clothingId: 'PHOTO-01', photoId: id },
          { resource: 'products' },
        ),
        admin,
        branchId,
      )) as CatalogRecord;
      const replaced = await request(app)
        .post(root)
        .send({ data: png.toString('base64') });
      const next = (await run(
        command(
          'catalog.update',
          { name: 'Photo dress', photoId: replaced.body.data.photoId },
          { resource: 'products', targetId: linked._id, expectedVersion: 1 },
        ),
        admin,
        branchId,
      )) as CatalogRecord;
      expect(next.photoId).not.toBe(id);
      const removed = (await run(
        command(
          'catalog.update',
          { name: 'Photo dress', photoId: null },
          { resource: 'products', targetId: linked._id, expectedVersion: 2 },
        ),
        admin,
        branchId,
      )) as CatalogRecord;
      expect(removed.photoId).toBeNull();
      expect((await request(app).get(`${root}/${id}`)).status).toBe(200);
      const other = admin.branchIds.find((value) => value !== branchId)!;
      expect(
        (
          await request(app).get(
            `/api/v1/branches/${other}/clothing-photos/${id}`,
          )
        ).status,
      ).toBe(404);
      if (branchId !== 'sham-royal')
        expect(
          (
            await request(app)
              .get(`${root}/${id}`)
              .set('x-test-fixture', 'employee')
          ).status,
        ).toBe(403);
      await expect(
        run(
          command(
            'catalog.create',
            { name: 'Foreign photo', clothingId: 'FOREIGN', photoId: id },
            { resource: 'products' },
          ),
          admin,
          other,
        ),
      ).rejects.toThrow('not_found');
      expect(
        (
          await request(app)
            .post(root)
            .send({ data: Buffer.from('<svg></svg>').toString('base64') })
        ).status,
      ).toBe(422);
    }
    expect(
      (
        await request(app)
          .post('/api/v1/branches/sham-royal/clothing-photos')
          .set('x-test-fixture', 'employee')
          .send({ data: png.toString('base64') })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post('/api/v1/branches/sham-shaban/clothing-photos')
          .send({ data: png.toString('base64') })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post('/api/v1/branches/sham-royal/clothing-photos')
          .send({ data: Buffer.alloc(5 * 1024 * 1024 + 1).toString('base64') })
      ).status,
    ).toBe(413);
  });
  it('registers today and changed dates without treating an optional return as forever', async () => {
    const item = (await run(
      command(
        'catalog.create',
        {
          name: 'Calendar reservation dress',
          clothingId: 'CAL-RES-001',
        },
        { resource: 'products' },
      ),
    )) as CatalogRecord;
    const today =
      Math.floor((Date.now() + 16200000) / 86400000) * 86400000 - 16200000;
    const date = (days: number) =>
      new Date(today + days * 86400000).toISOString();
    const register = (days: number, returnDueAt: string | null = null) =>
      command('customer.register', {
        customer: { fullName: 'Calendar customer', telephone: '0700000123' },
        transaction: {
          productId: item._id,
          type: 'rental',
          agreedPrice: '10',
          reservationAt: date(days),
          returnDueAt,
        },
      });
    // A future booking must not prevent registering today.
    await run(register(5));
    const saved = await run(register(0));
    expect(saved).toHaveProperty(
      'transaction.reservationAt',
      new Date(date(0)),
    );
    await expect(run(register(0))).rejects.toThrow('reservation_conflict');
    // Retry the rejected customer registration on another date.
    await run(register(1, date(1)));
    await expect(run(register(1))).rejects.toThrow('reservation_conflict');
    await run(register(2));
    const availability = async (days: number, branchId = 'sham-royal') =>
      request(app)
        .get(`/api/v1/branches/${branchId}/products/${item._id}/availability`)
        .query({ type: 'rental', reservationAt: date(days) });
    expect((await availability(0)).body.data.available).toBe(false);
    expect((await availability(3)).body.data.available).toBe(true);
    expect((await availability(3, 'sham-aroos')).status).toBe(404);
    await expect(run(register(3), admin, 'sham-aroos')).rejects.toThrow(
      'not_found',
    );
    await Transaction.updateOne(
      { 'product.id': item._id, reservationAt: new Date(date(0)) },
      { $set: { status: 'delivered' } },
    );
    expect((await availability(3)).body.data.available).toBe(false);
    const created = await Transaction.find({ 'product.id': item._id });
    await Customer.deleteMany({
      _id: { $in: created.map((row) => row.customerId) },
    });
    await Transaction.deleteMany({ 'product.id': item._id });
  });
  it('serializes competing reservations and accepts adjacent rental intervals', async () => {
    const item = (await run(
      command(
        'catalog.create',
        { name: 'Concurrent physical dress', clothingId: 'CON-001' },
        { resource: 'products' },
      ),
    )) as CatalogRecord;
    const start = new Date(Date.now() + 10 * 86400000).toISOString();
    const end = new Date(Date.now() + 11 * 86400000).toISOString();
    const data = {
      customerId: customer._id,
      productId: item._id,
      type: 'rental',
      agreedPrice: '10',
      reservationAt: start,
      returnDueAt: end,
    };
    const results = await Promise.allSettled([
      run(command('transaction.create', data)),
      run(command('transaction.create', data)),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const rejected = results.find(
      (result) => result.status === 'rejected',
    ) as PromiseRejectedResult;
    expect(rejected.reason.message).toBe('reservation_conflict');
    expect(await Transaction.countDocuments({ 'product.id': item._id })).toBe(
      1,
    );
    const next = (await run(
      command('transaction.create', {
        ...data,
        reservationAt: end,
        returnDueAt: new Date(Date.now() + 12 * 86400000).toISOString(),
      }),
    )) as TransactionRecord;
    expect(next.product.clothingId).toBe('CON-001');
    await expect(
      run(command('transaction.create', data), admin, 'sham-aroos'),
    ).rejects.toThrow();
  });
  it('preserves product snapshots and supports rentals with optional package quantities', async () => {
    await run(
      command(
        'catalog.update',
        {
          name: 'Changed dress',
          price: '2000',
          productType: 'Changed',
          brand: 'Other',
          color: 'Red',
        },
        { resource: 'products', targetId: product._id, expectedVersion: 2 },
      ),
    );
    expect(
      (await Transaction.findById(transaction._id))!.product.originalMinor,
    ).toBe(100025);
    const item = (await run(
      command(
        'catalog.create',
        { name: 'Accessory', price: '10.10', quantity: 2, color: 'Gold' },
        { resource: 'package-items' },
      ),
    )) as CatalogRecord;
    const rentalProduct = (await run(
      command(
        'catalog.create',
        { name: 'Rental dress', clothingId: 'SR-002' },
        { resource: 'products' },
      ),
    )) as CatalogRecord;
    const rental = (await run(
      command('transaction.create', {
        customerId: customer._id,
        productId: rentalProduct._id,
        type: 'rental',
        agreedPrice: '200',
        advance: '20',
        packages: [{ itemId: item._id, quantity: 3 }],
        reservationAt: new Date().toISOString(),
      }),
    )) as TransactionRecord;
    expect(rental.totalMinor).toBe(23030);
    expect(rental.totalMinor - rental.paidMinor).toBe(21030);
    expect(
      await Transaction.countDocuments({
        customerId: customer._id,
        'product.id': { $in: [product._id, rentalProduct._id] },
      }),
    ).toBe(2);
  });
  it('prevents overpayments and rolls back every part of an invalid transaction', async () => {
    const before = await Transaction.countDocuments();
    await expect(
      run(
        command('transaction.create', {
          customerId: customer._id,
          productId: product._id,
          type: 'purchase',
          agreedPrice: '10',
          advance: '11',
          reservationAt: new Date().toISOString(),
        }),
        {
          ...admin,
          permissions: admin.permissions.filter(
            (p) => p !== 'payments.overpay',
          ),
        },
      ),
    ).rejects.toThrow('overpayment');
    expect(await Transaction.countDocuments()).toBe(before);
  });
  it('makes additional payments idempotent and rejects changed payload reuse', async () => {
    const cmd = command('payment.create', {
      transactionId: transaction._id,
      amount: '50.05',
      method: 'cash',
      expectedVersion: 1,
    });
    const first = (await run(cmd)) as {
      payment: { _id: string };
      transaction: TransactionRecord;
    };
    const second = (await run(cmd)) as typeof first;
    expect(second.payment._id).toBe(first.payment._id);
    expect(
      await Payment.countDocuments({ transactionId: transaction._id }),
    ).toBe(2);
    expect(first.transaction.paidMinor).toBe(15015);
    await expect(
      run({ ...cmd, data: { ...(cmd.data as object), amount: '51' } }),
    ).rejects.toThrow('idempotency_mismatch');
  });
  it('serializes concurrent payments and returns a visible version conflict', async () => {
    const version = (await Transaction.findById(transaction._id))!.version;
    const results = await Promise.allSettled([
      run(
        command('payment.create', {
          transactionId: transaction._id,
          amount: '10',
          method: 'cash',
          expectedVersion: version,
        }),
      ),
      run(
        command('payment.create', {
          transactionId: transaction._id,
          amount: '11',
          method: 'cash',
          expectedVersion: version,
        }),
      ),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(
      (
        results.find(
          (result) => result.status === 'rejected',
        ) as PromiseRejectedResult
      ).reason.message,
    ).toBe('version_conflict');
    const record = (await Transaction.findById(transaction._id))!;
    const sum = await Payment.aggregate([
      { $match: { transactionId: transaction._id } },
      { $group: { _id: null, amount: { $sum: '$amountMinor' } } },
    ]);
    expect(record.paidMinor).toBe(sum[0].amount);
  });
  it('reverses payments without deleting history or allowing double reversal', async () => {
    const original = (await Payment.findOne({
      transactionId: transaction._id,
      origin: 'additional',
    }))!;
    const current = (await Transaction.findById(transaction._id))!;
    const result = (await run(
      command(
        'payment.reverse',
        { expectedVersion: current.version, reason: 'Test correction' },
        { targetId: original._id },
      ),
    )) as { payment: { amountMinor: number }; transaction: TransactionRecord };
    expect(result.payment.amountMinor).toBe(-original.amountMinor);
    expect(await Payment.findById(original._id)).not.toBeNull();
    await expect(
      run(
        command(
          'payment.reverse',
          {
            expectedVersion: result.transaction.version,
            reason: 'Repeat reversal',
          },
          { targetId: original._id },
        ),
      ),
    ).rejects.toThrow('payment_already_reversed');
  });
  it('denies cross-branch records, disabled branches and ungranted operations', async () => {
    expect(
      (
        await request(app).get(
          `/api/v1/branches/sham-aroos/transactions/${transaction._id}`,
        )
      ).status,
    ).toBe(404);
    expect(
      (await request(app).get('/api/v1/branches/sham-shaban/products')).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .get('/api/v1/branches/sham-aroos/products')
          .set('x-test-fixture', 'employee')
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post('/api/v1/branches/sham-royal/commands')
          .set('x-test-fixture', 'employee')
          .send(
            command(
              'catalog.create',
              { name: 'Denied', price: '1' },
              { resource: 'products' },
            ),
          )
      ).status,
    ).toBe(403);
    await expect(
      run(
        command('transaction.create', {
          customerId: customer._id,
          productId: product._id,
          type: 'rental',
          agreedPrice: '10',
          reservationAt: new Date().toISOString(),
        }),
        admin,
        'sham-aroos',
      ),
    ).rejects.toThrow('not_found');
  });
  it('creates permanent invoice snapshots and isolates print access', async () => {
    const invoice = (await run(
      command('invoice.issue', { transactionId: transaction._id }),
    )) as { _id: string; snapshot: { transaction: TransactionRecord } };
    const stored = (await Invoice.findById(invoice._id))!;
    expect(stored.snapshot.transaction).toBeDefined();
    expect(invoice.snapshot.transaction.product.name).toBe('Royal dress');
    expect(
      (
        await request(app).get(
          `/api/v1/branches/sham-aroos/invoices/${invoice._id}`,
        )
      ).status,
    ).toBe(404);
  });
  it('keeps delivery independent from payment settlement and rejects cancelled paid orders', async () => {
    const current = (await Transaction.findById(transaction._id))!;
    const ready = (await run(
      command(
        'delivery.update',
        { expectedVersion: current.version, status: 'ready' },
        { targetId: transaction._id },
      ),
    )) as TransactionRecord;
    const delivered = (await run(
      command(
        'delivery.update',
        { expectedVersion: ready.version, status: 'delivered' },
        { targetId: transaction._id },
      ),
    )) as TransactionRecord;
    expect(delivered.paidMinor).toBe(current.paidMinor);
    expect(delivered.paidMinor < delivered.totalMinor).toBe(true);
    await expect(
      run(
        command(
          'delivery.update',
          { expectedVersion: delivered.version, status: 'cancelled' },
          { targetId: transaction._id },
        ),
      ),
    ).rejects.toThrow();
  });
  it('reconciles tomorrow and overdue notifications without duplicates', async () => {
    const reminderProduct = (await run(
      command(
        'catalog.create',
        { name: 'Reminder dress', clothingId: 'SR-003' },
        { resource: 'products' },
      ),
    )) as CatalogRecord;
    const tomorrow = (await run(
      command('transaction.create', {
        customerId: customer._id,
        productId: reminderProduct._id,
        type: 'rental',
        agreedPrice: '50',
        reservationAt: new Date(Date.now() + 86400000).toISOString(),
      }),
    )) as TransactionRecord;
    await reconcileNotifications();
    await reconcileNotifications();
    expect(
      await Notification.countDocuments({
        transactionId: tomorrow._id,
        type: 'tomorrow',
      }),
    ).toBe(1);
    const inbox = await request(app).get(
      '/api/v1/branches/sham-royal/notifications',
    );
    expect(
      inbox.body.data.items.find(
        (item: { transactionId: string }) =>
          item.transactionId === tomorrow._id,
      ),
    ).toMatchObject({ amountMinor: '5000', currency: 'AFN' });
    await reconcileNotifications(new Date(Date.now() + 3 * 86400000));
    expect(
      await Notification.countDocuments({
        transactionId: tomorrow._id,
        type: 'overdue',
      }),
    ).toBe(1);
  });
  it('enforces provisional offline payment policy and detects stale-device conflicts', async () => {
    const current = (await Transaction.findById(transaction._id))!;
    const offline = command('payment.create', {
      transactionId: current._id,
      amount: '1',
      method: 'cash',
      expectedVersion: current.version,
    });
    await expect(run(offline, admin, 'sham-royal', true)).rejects.toThrow(
      'offline_payment_denied',
    );
    const settings = (await BranchSettings.findOne({
      branchId: 'sham-royal',
    }))!;
    await run(
      command('settings.update', {
        expectedVersion: settings.version,
        currency: 'AFN',
        paymentMethods: ['cash', 'bank'],
        offlinePayments: true,
        offlinePaymentLimit: '100',
        companyName: 'Test company',
        address: '',
        telephone: '',
      }),
    );
    const accepted = (await run(offline, admin, 'sham-royal', true)) as {
      transaction: TransactionRecord;
    };
    expect(accepted.transaction.version).toBe(current.version + 1);
    const response = await request(app)
      .post('/api/v1/branches/sham-royal/sync/push')
      .send({
        operations: [
          command('payment.create', {
            transactionId: current._id,
            amount: '2',
            method: 'cash',
            expectedVersion: current.version,
          }),
        ],
      });
    expect(response.body.data[0].status).toBe('conflict');
  });
  it('records financial audit trails and reports real database totals', async () => {
    expect(
      await AuditLog.countDocuments({
        branchId: 'sham-royal',
        resource: 'payments',
      }),
    ).toBeGreaterThan(4);
    const data = await report(
      context(admin, 'sham-royal'),
      listQuery.parse({}),
    );
    expect(data.customers).toBe(1);
    expect(data.totals.count).toBe(
      await Transaction.countDocuments({
        branchId: 'sham-royal',
        status: { $ne: 'cancelled' },
      }),
    );
    expect(typeof data.totals.agreedMinor).toBe('string');
    expect(data.newCustomers).toBe(1);
    expect(data.recentCustomers).toHaveLength(1);
    expect(data.recentCustomers[0]!._id).toBe(customer._id);
    expect(data.overdueCount).toBe(
      await Transaction.countDocuments({
        branchId: 'sham-royal',
        status: { $in: ['pending', 'ready'] },
        reservationAt: {
          $lt: new Date(kabulDay(new Date()) * 86400000 - 270 * 60000),
        },
      }),
    );
    expect(data.upcomingCount).toBe(
      await Transaction.countDocuments({
        branchId: 'sham-royal',
        status: { $in: ['pending', 'ready'] },
        reservationAt: {
          $gte: new Date(kabulDay(new Date()) * 86400000 - 270 * 60000),
          $lt: new Date((kabulDay(new Date()) + 7) * 86400000 - 270 * 60000),
        },
      }),
    );
  });
});

describe('completed account workflows', () => {
  it('atomically registers USD customer/items/advance, retries once and rolls back invalid initial transactions', async () => {
    const product = (await run(
      command(
        'catalog.create',
        { name: 'USD item', clothingId: 'USD-TEST', price: '1000' },
        { resource: 'products' },
      ),
      admin,
      'dollar',
    )) as CatalogRecord;
    const packageItem = (await run(
      command(
        'catalog.create',
        { name: 'USD accessory', price: '25' },
        { resource: 'package-items' },
      ),
      admin,
      'dollar',
    )) as CatalogRecord;
    const data = {
      customer: {
        fullName: 'USD account',
        telephone: '0700000000',
        address: 'Kabul',
      },
      transaction: {
        productId: product._id,
        type: 'purchase',
        agreedPrice: '950',
        advance: '300',
        reservationAt: new Date(Date.now() + 86400000).toISOString(),
        packages: [{ itemId: packageItem._id, quantity: 2 }],
      },
    };
    const cmd = command('customer.register', data);
    const registered = (await run(cmd, admin, 'dollar')) as {
      customer: CustomerRecord;
      transaction: TransactionRecord;
    };
    expect(registered.transaction).toMatchObject({
      currency: 'USD',
      totalMinor: 100000,
      paidMinor: 30000,
    });
    const retried = (await run(cmd, admin, 'dollar')) as typeof registered;
    expect(retried.customer._id).toBe(registered.customer._id);
    expect(
      await Payment.countDocuments({
        transactionId: registered.transaction._id,
      }),
    ).toBe(1);
    const count = await mongoose.connection
      .collection('customers')
      .countDocuments({ branchId: 'dollar' });
    await expect(
      run(
        command('customer.register', {
          ...data,
          customer: { ...data.customer, fullName: 'Rolled back' },
          transaction: { ...data.transaction, productId: randomUUID() },
        }),
        admin,
        'dollar',
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      await mongoose.connection
        .collection('customers')
        .countDocuments({ branchId: 'dollar' }),
    ).toBe(count);
    await expect(async () =>
      run(command('customer.register', data), user, 'dollar'),
    ).rejects.toMatchObject({ status: 403 });
    const account = await customerDetail(
      context(admin, 'dollar'),
      registered.customer._id,
    );
    expect(account.balances).toEqual([
      {
        currency: 'USD',
        totalMinor: '100000',
        paidMinor: '30000',
        outstandingMinor: '70000',
      },
    ]);
    const payment = command('payment.create', {
      transactionId: registered.transaction._id,
      amount: '200',
      method: 'cash',
      reference: 'TEST-USD',
      expectedVersion: 1,
    });
    await run(payment, admin, 'dollar');
    await run(payment, admin, 'dollar');
    expect(
      (await Transaction.findById(registered.transaction._id))!.paidMinor,
    ).toBe(50000);
    expect(
      await Payment.countDocuments({
        transactionId: registered.transaction._id,
      }),
    ).toBe(2);
    const competing = await Promise.allSettled(
      [1, 2].map(() =>
        run(
          command('payment.create', {
            transactionId: registered.transaction._id,
            amount: '400',
            method: 'cash',
            expectedVersion: 2,
          }),
          {
            ...admin,
            permissions: admin.permissions.filter(
              (p) => p !== 'payments.overpay',
            ),
          },
          'dollar',
        ),
      ),
    );
    expect(
      competing.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      (await Transaction.findById(registered.transaction._id))!.paidMinor,
    ).toBe(90000);
    await expect(
      run(
        command(
          'transaction.update',
          {
            expectedVersion: 3,
            agreedPrice: '100',
            reservationAt: data.transaction.reservationAt,
            notes: '',
          },
          { targetId: registered.transaction._id },
        ),
        admin,
        'dollar',
      ),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      run(
        command(
          'transaction.update',
          {
            expectedVersion: 3,
            agreedPrice: '1000',
            reservationAt: data.transaction.reservationAt,
            notes: '',
          },
          { targetId: registered.transaction._id },
        ),
        admin,
        'sham-royal',
      ),
    ).rejects.toMatchObject({ status: 404 });
    const edited = (await run(
      command(
        'transaction.update',
        {
          expectedVersion: 3,
          agreedPrice: '1000',
          reservationAt: new Date(Date.now() + 2 * 86400000).toISOString(),
          notes: 'Updated',
        },
        { targetId: registered.transaction._id },
      ),
      admin,
      'dollar',
    )) as TransactionRecord;
    expect(edited).toMatchObject({
      totalMinor: 105000,
      paidMinor: 90000,
      version: 4,
    });
    expect(
      (await Payment.findOne({
        transactionId: registered.transaction._id,
        reference: 'TEST-USD',
      }))!.currency,
    ).toBe('USD');
    expect(
      (await report(context(admin, 'dollar'), listQuery.parse({}))).currency,
    ).toBe('USD');
    expect(
      await AuditLog.countDocuments({
        branchId: 'dollar',
        action: 'transaction.update',
        recordId: edited._id,
      }),
    ).toBe(1);
  });
});

describe('money adjustments and additive preservation', () => {
  it('keeps cents exact, rejects invalid adjustments, backfills currency without altering records', async () => {
    const product = (await run(
      command(
        'catalog.create',
        {
          name: 'Adjustment fixture',
          clothingId: 'ADJUST-USD',
          price: '100.10',
        },
        { resource: 'products' },
      ),
      admin,
      'dollar',
    )) as CatalogRecord;
    const data = {
      customer: { fullName: 'Adjustment account', telephone: '0701230000' },
      transaction: {
        productId: product._id,
        type: 'purchase',
        agreedPrice: '100.10',
        discount: '10.05',
        charges: '0.02',
        advance: '0.01',
        reservationAt: new Date().toISOString(),
      },
    };
    const registered = (await run(
      command('customer.register', data),
      admin,
      'dollar',
    )) as { customer: CustomerRecord; transaction: TransactionRecord };
    expect(registered.transaction).toMatchObject({
      totalMinor: 9007,
      paidMinor: 1,
      discountMinor: 1005,
      chargesMinor: 2,
    });
    const payment = (await Payment.findOne({
      transactionId: registered.transaction._id,
    }).lean())!;
    await Payment.collection.updateOne(
      { _id: payment._id as never },
      { $unset: { currency: '' } },
    );
    await migrateOperations();
    await migrateOperations();
    expect(
      await Transaction.findById(registered.transaction._id).lean(),
    ).toMatchObject({
      _id: registered.transaction._id,
      totalMinor: 9007,
      paidMinor: 1,
    });
    expect(await Payment.findById(payment._id).lean()).toMatchObject({
      _id: payment._id,
      currency: 'USD',
      amountMinor: 1,
    });
    const query = await request(app).get(
      `/api/v1/branches/dollar/audit-logs?customerId=${registered.customer._id}`,
    );
    expect(query.status).toBe(200);
    expect(
      query.body.data.items.every(
        (row: { branchId: string }) => row.branchId === 'dollar',
      ),
    ).toBe(true);
    expect(
      (
        await request(app).get(
          `/api/v1/branches/sham-royal/audit-logs?customerId=${registered.customer._id}`,
        )
      ).status,
    ).toBe(404);
    const count = await mongoose.connection
      .collection('customers')
      .countDocuments();
    await expect(
      run(
        command('customer.register', {
          ...data,
          transaction: { ...data.transaction, discount: '1000' },
        }),
        admin,
        'dollar',
      ),
    ).rejects.toMatchObject({ status: 422 });
    expect(
      await mongoose.connection.collection('customers').countDocuments(),
    ).toBe(count);
    await expect(
      run(
        command('customer.register', {
          ...data,
          transaction: { ...data.transaction, advance: '0' },
        }),
        {
          ...admin,
          permissions: admin.permissions.filter(
            (p) => p !== 'transactions.create',
          ),
        },
        'dollar',
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(
      await mongoose.connection.collection('customers').countDocuments(),
    ).toBe(count);
  });
});

describe('record currencies and Kabul calendar dates', () => {
  it('saves today for an employee, preserves dates after reload, and rejects historical order backdating', async () => {
    const product = (await run(
      command(
        'catalog.create',
        { name: 'Today fixture', clothingId: 'TODAY-FIXTURE', price: '100' },
        { resource: 'products' },
      ),
    )) as CatalogRecord;
    const now = new Date();
    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kabul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
    const midnight = new Date(`${date}T00:00:00+04:30`).toISOString();
    const payload = {
      customer: { fullName: 'Today operator', telephone: '0700000123' },
      transaction: {
        productId: product._id,
        type: 'rental',
        currency: 'USD',
        agreedPrice: '100',
        orderAt: midnight,
        reservationAt: midnight,
      },
    };
    const created = (await run(
      command('customer.register', payload),
      user,
    )) as { customer: CustomerRecord; transaction: TransactionRecord };
    const response = await request(app)
      .get(
        `/api/v1/branches/sham-royal/transactions/${created.transaction._id}`,
      )
      .set('x-test-fixture', 'employee');
    expect(response.status).toBe(200);
    expect(response.body.data.orderAt).toBe(midnight);
    expect(response.body.data.reservationAt).toBe(midnight);
    expect(response.body.data.currency).toBe('USD');
    const yesterday = new Date(Date.parse(midnight) - 86400000).toISOString();
    await expect(
      run(
        command('customer.register', {
          ...payload,
          transaction: { ...payload.transaction, orderAt: yesterday },
        }),
        user,
      ),
    ).rejects.toMatchObject({ status: 403 });
    const cross = await request(app).get(
      `/api/v1/branches/sham-aroos/transactions/${created.transaction._id}`,
    );
    expect(cross.status).toBe(404);
  });

  it('keeps AFN and USD independent in every branch, expenses, account, report, payments and invoices', async () => {
    for (const branch of admin.branchIds) {
      const customer = (await run(
        command('customer.create', {
          fullName: `Two currencies ${branch}`,
          telephone: '0700000333',
        }),
        admin,
        branch,
      )) as CustomerRecord;
      for (const currency of ['AFN', 'USD'] as const) {
        const product = (await run(
          command(
            'catalog.create',
            {
              name: `Mixed ${branch} ${currency}`,
              clothingId: `MIX-${branch}-${currency}`,
              currency,
              price: '100',
            },
            { resource: 'products' },
          ),
          admin,
          branch,
        )) as CatalogRecord;
        expect(product.currency).toBe(currency);
        const created = (await run(
          command('transaction.create', {
            customerId: customer._id,
            productId: product._id,
            type: 'purchase',
            currency,
            agreedPrice: currency === 'AFN' ? '15000' : '100',
            reservationAt: new Date().toISOString(),
          }),
          admin,
          branch,
        )) as TransactionRecord;
        const opposite = currency === 'AFN' ? 'USD' : 'AFN';
        await expect(
          run(
            command('payment.create', {
              transactionId: created._id,
              currency: opposite,
              amount: '1',
              method: 'cash',
              expectedVersion: created.version,
            }),
            admin,
            branch,
          ),
        ).rejects.toMatchObject({ status: 422 });
        const payment = (await run(
          command('payment.create', {
            transactionId: created._id,
            currency,
            amount: '10',
            method: 'cash',
            expectedVersion: created.version,
          }),
          admin,
          branch,
        )) as { payment: { currency: string } };
        expect(payment.payment.currency).toBe(currency);
        const invoice = (await run(
          command('invoice.issue', { transactionId: created._id }),
          admin,
          branch,
        )) as { snapshot: { transaction: { currency: string } } };
        expect(invoice.snapshot.transaction.currency).toBe(currency);
        const expense = (await run(
          command('expense.create', {
            name: `Mixed expense ${currency}`,
            currency,
            amount: '12.34',
            expenseAt: new Date().toISOString(),
            spentBy: 'Test',
          }),
          admin,
          branch,
        )) as { currency: string };
        expect(expense.currency).toBe(currency);
        const reports = await report(
          context(admin, branch),
          listQuery.parse({ customerId: customer._id, currency }),
        );
        expect(reports.currency).toBe(currency);
        expect(reports.totals.agreedMinor).toBe(
          currency === 'AFN' ? '1500000' : '10000',
        );
        expect(reports.currencyReports).toHaveLength(2);
      }
      const account = await customerDetail(
        context(admin, branch),
        customer._id,
      );
      expect(account.balances).toEqual(
        expect.arrayContaining([
          {
            currency: 'AFN',
            totalMinor: '1500000',
            paidMinor: '1000',
            outstandingMinor: '1499000',
          },
          {
            currency: 'USD',
            totalMinor: '10000',
            paidMinor: '1000',
            outstandingMinor: '9000',
          },
        ]),
      );
      const listed = await request(app).get(
        `/api/v1/branches/${branch}/customers?q=${encodeURIComponent(customer.fullName)}`,
      );
      expect(listed.body.data.items[0].balances).toEqual(
        expect.arrayContaining(account.balances),
      );
      const filtered = await request(app).get(
        `/api/v1/branches/${branch}/customers?q=${encodeURIComponent(customer.fullName)}&type=purchase&status=pending&outstanding=true&currency=USD&sort=fullName&direction=asc&limit=1&page=1`,
      );
      expect(filtered.status).toBe(200);
      expect(filtered.body.data.total).toBe(1);
      expect(filtered.body.data.items[0]._id).toBe(customer._id);
      expect(filtered.body.data.items[0].latestTransaction.currency).toBe(
        'USD',
      );
      const next = await request(app).get(
        `/api/v1/branches/${branch}/customers?q=${encodeURIComponent(customer.fullName)}&limit=1&page=2`,
      );
      expect(next.body.data.items).toEqual([]);
      const other = admin.branchIds.find((id) => id !== branch)!;
      expect(
        (
          await request(app).get(
            `/api/v1/branches/${other}/customers/${customer._id}`,
          )
        ).status,
      ).toBe(404);
    }
  });

  it('adds only missing historical currency and is safe to rerun', async () => {
    const expense = (await run(
      command('expense.create', {
        name: 'Legacy metadata',
        amount: '99.17',
        expenseAt: new Date().toISOString(),
        spentBy: 'Test',
      }),
      admin,
      'dollar',
    )) as { _id: string };
    await Expense.collection.updateOne(
      { _id: expense._id as never },
      { $unset: { currency: '' } },
    );
    await migrateCurrency();
    await migrateCurrency();
    const saved = await Expense.findById(expense._id).lean();
    expect(saved).toMatchObject({ currency: 'USD', amountMinor: 9917 });
  });
});

describe('system review: calendar and outstanding filters', () => {
  it('keeps today in upcoming lists, excludes cancelled debt, and preserves branch/owner scope', async () => {
    const today = kabulDay(new Date()) * 86400000 - 16200000;
    const date = (days: number) =>
      new Date(today + days * 86400000).toISOString();
    const customer = (await run(
      command('customer.create', {
        fullName: 'Filter review account',
        telephone: '0700012345',
      }),
    )) as CustomerRecord;
    const product = (await run(
      command(
        'catalog.create',
        { name: 'Filter review dress', clothingId: 'FILTER-REVIEW' },
        { resource: 'products' },
      ),
    )) as CatalogRecord;
    const create = (days: number) =>
      run(
        command('transaction.create', {
          customerId: customer._id,
          productId: product._id,
          type: 'rental',
          agreedPrice: '10',
          reservationAt: date(days),
        }),
      );
    const yesterday = (await create(-1)) as TransactionRecord;
    const current = (await create(0)) as TransactionRecord;
    await create(7);
    const root = '/api/v1/branches/sham-royal';
    const upcoming = await request(app)
      .get(`${root}/transactions`)
      .query({ customerId: customer._id, upcoming: 'true' });
    expect(upcoming.status).toBe(200);
    expect(
      upcoming.body.data.items.map((row: TransactionRecord) => row._id),
    ).toEqual([current._id]);
    const customers = await request(app)
      .get(`${root}/customers`)
      .query({ q: customer.fullName, upcoming: 'true' });
    expect(
      customers.body.data.items.map((row: CustomerRecord) => row._id),
    ).toEqual([customer._id]);
    const cancelled = (await run(
      command('customer.register', {
        customer: {
          fullName: 'Cancelled review account',
          telephone: '0700012346',
        },
        transaction: {
          productId: product._id,
          type: 'rental',
          agreedPrice: '20',
          reservationAt: date(2),
        },
      }),
    )) as { customer: CustomerRecord; transaction: TransactionRecord };
    await run(
      command(
        'delivery.update',
        { expectedVersion: 1, status: 'cancelled' },
        { targetId: cancelled.transaction._id },
      ),
    );
    for (const path of ['customers', 'transactions']) {
      const filtered = await request(app)
        .get(`${root}/${path}`)
        .query({ q: 'Cancelled review', outstanding: 'true' });
      expect(filtered.status).toBe(200);
      expect(filtered.body.data.total).toBe(0);
    }
    const cancelledOnly = await request(app).get(`${root}/transactions`).query({
      customerId: cancelled.customer._id,
      status: 'cancelled',
      outstanding: 'true',
    });
    expect(cancelledOnly.body.data.total).toBe(0);
    const deliveredReport = await report(
      context(admin, 'sham-royal'),
      listQuery.parse({ customerId: customer._id, status: 'delivered' }),
    );
    expect(deliveredReport.totals.count).toBe(0);
    const debt = await request(app)
      .get(`${root}/transactions`)
      .query({ customerId: customer._id, outstanding: 'true' });
    expect(
      debt.body.data.items.some(
        (row: TransactionRecord) => row._id === yesterday._id,
      ),
    ).toBe(true);
    for (const path of ['customers', 'transactions']) {
      const foreign = await request(app)
        .get(`/api/v1/branches/sham-aroos/${path}`)
        .query({ q: 'Filter review', upcoming: 'true' });
      expect(foreign.body.data.total).toBe(0);
      const own = await request(app)
        .get(`${root}/${path}`)
        .set('x-test-fixture', 'employee')
        .query({ q: 'Filter review', upcoming: 'true' });
      expect(own.body.data.total).toBe(0);
    }
  });
});
