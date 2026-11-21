#!/usr/bin/env node
// Local development demo seeder and end-to-end verification.
// Adds realistic information to every active branch and every module through
// the real command/HTTP pipeline (never by writing to MongoDB directly), then
// re-reads each module as admin, manager and employee to prove the whole
// system answers without errors and keeps branch/permission boundaries.
//
// Safe and rerunnable: every write uses a deterministic operation id derived
// from the persisted seed anchor, so a second run replays the stored result
// instead of duplicating records.
import http from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../../backend/dist/app.js';
import { parseEnv } from '../../backend/dist/config/env.js';
import { initializeDatabase } from '../../backend/dist/database/bootstrap.js';

const values = {
  ...dotenv.parse(
    readFileSync(new URL('../../backend/.env', import.meta.url), 'utf8'),
  ),
  ...process.env,
};
if (
  values.NODE_ENV !== 'development' ||
  !/^mongodb:\/\/127\.0\.0\.1:27018\//.test(values.MONGODB_URI || '')
)
  throw new Error(
    'Demo seeding is restricted to the isolated local development database.',
  );

const BRANCHES = ['sham-royal', 'sham-aroos', 'sham-aroos-vip', 'dollar'];
const KABUL_MS = 4.5 * 3600000;
const dayIndex = (ms) => Math.floor((ms + KABUL_MS) / 86400000);

const stateDirectory = new URL('../../.local/', import.meta.url);
mkdirSync(stateDirectory, { recursive: true });
const statePath = new URL('seed-state.json', stateDirectory);
const state = existsSync(statePath)
  ? JSON.parse(readFileSync(statePath, 'utf8'))
  : null;
const anchor = state?.anchorMs ?? dayIndex(Date.now()) * 86400000 - KABUL_MS;
if (!state)
  writeFileSync(
    statePath,
    JSON.stringify(
      { version: 1, anchorMs: anchor, createdAt: new Date().toISOString() },
      null,
      2,
    ),
  );
const at = (offset, hour = 10) =>
  new Date(anchor + offset * 86400000 + hour * 3600000).toISOString();

const uuidFrom = (seed) => {
  const buffer = Buffer.from(
    createHash('sha256').update(seed).digest().subarray(0, 16),
  );
  buffer[6] = (buffer[6] & 0x0f) | 0x40;
  buffer[8] = (buffer[8] & 0x3f) | 0x80;
  const hex = buffer.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
const deviceId = (branchId) => uuidFrom(`${anchor}:device:${branchId}`);

const currencyOf = (branchId) => (branchId === 'dollar' ? 'USD' : 'AFN');

const plan = {
  'sham-royal': { prefix: 'SR', place: 'کابل، شهر نو' },
  'sham-aroos': { prefix: 'SA', place: 'کابل، کارته نو' },
  'sham-aroos-vip': { prefix: 'SV', place: 'کابل، وزیر اکبر خان' },
  dollar: { prefix: 'DL', place: 'کابل، سرای شهزاده' },
};

const products = [
  ['لباس عروسی کلاسیک', 0, '12000', '15000', '240', '300'],
  ['لباس عروسی مدرن', 0, '18000', '22000', '360', '450'],
  ['لباس نامزدی زنانه', 0, '15000', '18000', '300', '380'],
  ['کت و شلوار داماد', 1, '20000', '25000', '480', '600'],
  ['لباس دامادی رسمی', 1, '24000', '30000', '600', '750'],
  ['لباس مهمانی', 0, '16000', '20000', '340', '420'],
  ['چادری عروس', 2, '36000', '45000', '720', '900'],
  ['کیف و کفش عروس', 2, '10000', '12000', '200', '250'],
  ['روسری و حجاب', 2, '6500', '8000', '120', '150'],
];
const categories = ['لباس عروس', 'لباس داماد', 'لوازم جانبی'];
const packageItems = [
  ['بستهٔ کامل عروس', '5500', '7000', '110', '140'],
  ['بستهٔ پایه عروس', '3200', '4000', '70', '90'],
];
const customerNames = [
  'احمد شاه رحیمی',
  'فرشته نظری',
  'زهرا کریمی',
  'محمد یوسف طاهری',
  'سمیرا احمدی',
  'نصیر احمد نوری',
];
const expenses = [
  ['کرایهٔ دکان', '12000', '350', 'کرایهٔ ماهانهٔ نمایندگی'],
  ['برق و آب', '6000', '200', 'پرداخت ماهانهٔ خدمات'],
  ['معاش کارمندان', '45000', '1200', 'معاش ماهانهٔ تیم'],
  ['لوازم دفتری', '3500', '80', 'خرید نوشت‌افزار'],
];

let commands = 0;
const failures = [];
const checks = [];

function record(name, expected, actual, ok) {
  checks.push({ name, expected, actual, ok });
  if (!ok) failures.push(`${name}: expected ${expected}, got ${actual}`);
}

async function call(client, method, url, body, headers = {}) {
  const req = client[method](url).set('x-myt-request', '1');
  for (const [key, value] of Object.entries(headers)) req.set(key, value);
  return body === undefined ? req : req.send(body);
}

async function command(client, branchId, seedKey, action, data, extra = {}) {
  const response = await call(
    client,
    'post',
    `/api/v1/branches/${branchId}/commands`,
    {
      operationId: uuidFrom(`${anchor}:${branchId}:${seedKey}`),
      deviceId: deviceId(branchId),
      action,
      ...(extra.resource ? { resource: extra.resource } : {}),
      ...(extra.targetId ? { targetId: extra.targetId } : {}),
      ...(extra.expectedVersion
        ? { expectedVersion: extra.expectedVersion }
        : {}),
      data,
    },
  );
  if (response.status !== 200)
    throw new Error(
      `[${branchId}] ${action} "${seedKey}" failed: ${response.status} ${JSON.stringify(response.body?.error ?? response.body)}`,
    );
  commands++;
  return response.body.data;
}

async function seedBranch(client, branchId) {
  const currency = currencyOf(branchId);
  const { prefix, place } = plan[branchId];

  await command(client, branchId, 'device', 'device.register', {
    label: `${branchId} demo device`,
  });

  const categoryIds = [];
  for (const [index, name] of categories.entries())
    categoryIds.push(
      (
        await command(
          client,
          branchId,
          `category-${index}`,
          'catalog.create',
          {
            name,
          },
          { resource: 'product-categories' },
        )
      )._id,
    );

  const productIds = [];
  for (const [index, row] of products.entries()) {
    const [name, categoryIndex, afnOriginal, afnPrice, usdOriginal, usdPrice] =
      row;
    const created = await command(
      client,
      branchId,
      `product-${index}`,
      'catalog.create',
      {
        clothingId: `${prefix}-${100 + index}`,
        name,
        productType: categories[categoryIndex],
        brand: 'شرکت تجارتی محمد یوسف طاهریان',
        color: ['سفید', 'کریمی', 'طلایی'][index % 3],
        currency,
        price: currency === 'USD' ? usdPrice : afnPrice,
        quantity: 5,
        description: `${name} برای ${plan[branchId].place}`,
        categoryId: categoryIds[categoryIndex],
      },
      { resource: 'products' },
    );
    productIds.push({
      id: created._id,
      price: currency === 'USD' ? usdPrice : afnPrice,
      original: currency === 'USD' ? usdOriginal : afnOriginal,
    });
  }

  const packageIds = [];
  for (const [index, row] of packageItems.entries()) {
    const [name] = row;
    const spec = currency === 'USD' ? row[3] : row[1];
    packageIds.push(
      (
        await command(
          client,
          branchId,
          `package-${index}`,
          'catalog.create',
          {
            name,
            currency,
            price: spec,
            quantity: 1,
            description: name,
            color: 'طلایی',
          },
          { resource: 'package-items' },
        )
      )._id,
    );
  }

  const customerIds = [];
  for (const [index, fullName] of customerNames.entries())
    customerIds.push(
      (
        await command(
          client,
          branchId,
          `customer-${index}`,
          'customer.create',
          {
            fullName,
            telephone: `0700000${100 + index}`,
            whatsapp: `0790000${100 + index}`,
            address: `${place}، ناحیهٔ ${index + 1}`,
            secondaryPhone: '',
            notes: 'مشتری نمایشی',
          },
        )
      )._id,
    );

  const guaranteeId = (
    await catalogList(client, branchId, 'guarantees')
  ).items.find((item) => item.guaranteeType === 'tazkira')?._id;

  const rentalFees = [
    currency === 'USD' ? '80' : '3000',
    currency === 'USD' ? '120' : '4500',
    currency === 'USD' ? '60' : '2500',
    currency === 'USD' ? '100' : '3500',
  ];
  const transactions = [
    {
      customer: 0,
      product: 0,
      type: 'purchase',
      advance: 0.3,
      delivery: 'delivered',
      extra: 0.7,
      invoice: true,
      order: -22,
      reserve: -21,
    },
    {
      customer: 1,
      product: 1,
      type: 'purchase',
      advance: 0.2,
      delivery: 'delivered',
      extra: 0.5,
      reverse: true,
      invoice: true,
      order: -18,
      reserve: -17,
    },
    {
      customer: 2,
      product: 2,
      type: 'rental',
      fee: 0,
      advance: 0.15,
      delivery: 'pending',
      guarantee: true,
      order: -2,
      reserve: 2,
      due: 5,
    },
    {
      customer: 3,
      product: 3,
      type: 'rental',
      fee: 1,
      advance: 0,
      delivery: 'ready',
      order: 0,
      reserve: 1,
      due: 4,
    },
    {
      customer: 4,
      product: 4,
      type: 'rental',
      fee: 2,
      advance: 0.5,
      delivery: 'delivered',
      extra: 0.5,
      order: -12,
      reserve: -10,
      due: -7,
    },
    {
      customer: 5,
      product: 5,
      type: 'purchase',
      advance: 0.4,
      delivery: 'delivered',
      extra: 0.6,
      package: 0,
      invoice: true,
      order: -9,
      reserve: -8,
    },
    {
      customer: 0,
      product: 6,
      type: 'rental',
      fee: 3,
      advance: 0,
      delivery: 'pending',
      order: 0,
      reserve: 7,
      due: 10,
    },
  ];

  const transactionIds = [];
  for (const [index, spec] of transactions.entries()) {
    const price =
      spec.type === 'rental'
        ? rentalFees[spec.fee ?? 0]
        : productIds[spec.product].price;
    const packages =
      spec.package === undefined
        ? []
        : [{ itemId: packageIds[spec.package], quantity: 1 }];
    const discount =
      spec.type === 'purchase' && index === 5
        ? moneyValue(branchId, '2000', '50')
        : '0';
    const charges =
      spec.type === 'purchase' && index === 5
        ? moneyValue(branchId, '1500', '40')
        : '0';
    const net =
      Number(price) +
      packages.reduce(
        (sum) =>
          sum +
          Number(
            currency === 'USD'
              ? packageItems[spec.package][3]
              : packageItems[spec.package][1],
          ),
        0,
      ) -
      Number(discount) +
      Number(charges);
    const advance = spec.advance
      ? (net * spec.advance).toFixed(currency === 'USD' ? 2 : 0)
      : '0';
    const created = await command(
      client,
      branchId,
      `transaction-${index}`,
      'transaction.create',
      {
        currency,
        customerId: customerIds[spec.customer],
        productId: productIds[spec.product].id,
        type: spec.type,
        discount,
        charges,
        agreedPrice: price,
        advance,
        paymentMethod: 'cash',
        orderAt: at(spec.order, 11),
        reservationAt: at(spec.reserve, 12),
        returnDueAt: spec.due === undefined ? null : at(spec.due, 12),
        packages,
        guarantee:
          spec.guarantee && guaranteeId
            ? {
                typeId: guaranteeId,
                details: '',
                receivedAt: at(spec.order, 11),
              }
            : null,
        notes: 'معاملهٔ نمایشی',
      },
    );
    let version = created.version;
    const pkgExtra = packages.reduce(
      (sum) =>
        sum +
        Number(
          currency === 'USD'
            ? packageItems[spec.package][3]
            : packageItems[spec.package][1],
        ),
      0,
    );
    const total = Number(price) + pkgExtra - Number(discount) + Number(charges);
    if (spec.extra) {
      const amount = (total * spec.extra).toFixed(currency === 'USD' ? 2 : 0);
      const paid = await command(
        client,
        branchId,
        `payment-${index}`,
        'payment.create',
        {
          transactionId: created._id,
          amount,
          method: 'bank',
          paymentAt: at(spec.order + 1, 13),
          reference: `R-${prefix}-${index}`,
          notes: 'قسط دوم',
          expectedVersion: version,
        },
      );
      version = paid.transaction.version;
      if (spec.reverse) {
        const reversed = await command(
          client,
          branchId,
          `reversal-${index}`,
          'payment.reverse',
          {
            expectedVersion: version,
            reason: 'برگشت وجه به مشتری',
          },
          { targetId: paid.payment._id },
        );
        version = reversed.transaction.version;
      }
    }
    const deliveryPath = {
      pending: [],
      ready: ['ready'],
      delivered: ['ready', 'delivered'],
      returned: ['ready', 'delivered', 'returned'],
    }[spec.delivery];
    for (const status of deliveryPath) {
      const step = await command(
        client,
        branchId,
        `delivery-${index}-${status}`,
        'delivery.update',
        {
          expectedVersion: version,
          status,
          notes: status === 'delivered' ? 'تحویل به مشتری' : '',
          returnGuarantee: false,
        },
        { targetId: created._id },
      );
      version = step.version;
    }
    if (spec.invoice)
      await command(client, branchId, `invoice-${index}`, 'invoice.issue', {
        transactionId: created._id,
      });
    transactionIds.push({ id: created._id, version, spec, price });
  }

  for (const [index, [name, afn, usd, description]] of expenses.entries())
    await command(client, branchId, `expense-${index}`, 'expense.create', {
      currency,
      name,
      amount: currency === 'USD' ? usd : afn,
      expenseAt: at(-index - 1, 9),
      spentBy: 'مدیر نمایندگی',
      description,
    });

  const alterationPrice = (index) =>
    moneyValue(
      branchId,
      ['1500', '2000', '1200', '1800'][index],
      ['40', '60', '30', '50'][index],
    );
  const alterations = [
    {
      customer: 2,
      transaction: 2,
      type: 'size',
      expected: 3,
      status: 'pending',
    },
    {
      customer: 4,
      type: 'repair',
      start: -4,
      expected: -1,
      status: 'in_progress',
    },
    {
      customer: 5,
      type: 'length',
      start: -1,
      expected: 1,
      status: 'in_progress',
    },
    {
      customer: 1,
      type: 'style',
      start: 0,
      expected: 2,
      status: 'pending',
      transition: 'ready',
    },
  ];
  for (const [index, spec] of alterations.entries()) {
    const linked =
      spec.transaction === undefined ? null : transactionIds[spec.transaction];
    const original = linked
      ? productIds[linked.spec.product].price
      : productIds[(index + 1) % productIds.length].price;
    const created = await command(
      client,
      branchId,
      `alteration-${index}`,
      'alteration.create',
      {
        customerId: customerIds[spec.customer],
        transactionId: linked?.id ?? null,
        garmentId: `${prefix}-G${200 + index}`,
        garmentName: products[(index + 1) % products.length][0],
        garmentType: products[(index + 1) % products.length][0],
        brand: 'تعدیل داخلی',
        color: 'سفید',
        alterationType: spec.type,
        description: 'تعدیل اندازه و دوخت نمایشی',
        originalCurrency: currency,
        originalPrice: original,
        alterationPrice: alterationPrice(index),
        currency,
        tailorName: 'خانم خیاط',
        startAt: at(spec.start ?? -2, 9),
        expectedAt: at(spec.expected, 17),
        notes: 'تعدیل نمایشی',
      },
    );
    if (spec.transition)
      await command(
        client,
        branchId,
        `alteration-status-${index}`,
        'alteration.status',
        {
          expectedVersion: created.version,
          status: spec.transition,
        },
        { targetId: created._id },
      );
  }

  const settings = (
    await call(client, 'get', `/api/v1/branches/${branchId}/settings`)
  ).body.data;
  const settingsTarget = {
    currency,
    paymentMethods: ['cash', 'bank', 'mobile'],
    offlinePayments: true,
    offlinePaymentLimit: moneyValue(branchId, '5000', '500'),
    branchName: branchId.replaceAll('-', ' '),
    companyName: 'شرکت تجارتی محمد یوسف طاهریان',
    address: place,
    telephone: `0700${prefix}`.slice(0, 10),
  };
  // settings.update carries the live record version, so it cannot be replayed by
  // operation id; skip it once the branch already holds the target settings.
  if (
    settings.currency !== settingsTarget.currency ||
    settings.offlinePayments !== settingsTarget.offlinePayments ||
    settings.branchName !== settingsTarget.branchName ||
    settings.companyName !== settingsTarget.companyName ||
    settings.address !== settingsTarget.address ||
    settings.telephone !== settingsTarget.telephone
  )
    await command(client, branchId, 'settings', 'settings.update', {
      expectedVersion: settings.version,
      ...settingsTarget,
    });

  const existingMessages = (
    await call(client, 'get', `/api/v1/branches/${branchId}/messages`)
  ).body.data.items;
  for (const [, [title, body]] of [
    [
      'جلسهٔ هفتگی نمایندگی',
      'جلسهٔ بررسی فروش روز پنجشنبه ساعت ۹ صبح برگزار می‌شود.',
    ],
    [
      'یادآوری موجودی',
      'کنترل موجودی لباس‌های کرایه‌ای تا پایان هفته انجام شود.',
    ],
  ].entries())
    if (!existingMessages.some((message) => message.title === title)) {
      const response = await call(
        client,
        'post',
        `/api/v1/branches/${branchId}/messages`,
        { title, body },
      );
      if (response.status !== 201)
        throw new Error(
          `[${branchId}] message "${title}" failed: ${response.status}`,
        );
      commands++;
    }
}

function moneyValue(branchId, afn, usd) {
  return currencyOf(branchId) === 'USD' ? usd : afn;
}

async function catalogList(client, branchId, resource) {
  const response = await call(
    client,
    'get',
    `/api/v1/branches/${branchId}/${resource}?limit=100`,
  );
  if (response.status !== 200)
    throw new Error(
      `[${branchId}] list ${resource} failed: ${response.status}`,
    );
  return response.body.data;
}

async function seedAdvertisements(client) {
  const existing = (await call(client, 'get', '/api/v1/advertisements')).body
    .data;
  const banners = [
    {
      title: 'حراج ویژهٔ پایان فصل',
      body: 'تا ۳۰٪ تخفیف روی مجموعهٔ لباس عروسی.',
      linkLabel: 'مشاهده',
      order: 1,
    },
    {
      title: 'مجموعهٔ جدید عروس',
      body: 'کالکشن جدید سال با طراحی اختصاصی رسید.',
      linkLabel: 'جزئیات',
      order: 2,
    },
    {
      title: 'خدمات دوخت و تعدیل',
      body: 'تعدیل و ترمیم توسط خیاطان مجرب.',
      linkLabel: 'تماس',
      order: 3,
    },
  ];
  for (const banner of banners)
    if (!existing.some((item) => item.title === banner.title)) {
      const response = await call(client, 'post', '/api/v1/advertisements', {
        title: banner.title,
        body: banner.body,
        linkUrl: '',
        linkLabel: banner.linkLabel,
        photoId: null,
        active: true,
        order: banner.order,
        startsAt: null,
        endsAt: null,
      });
      if (response.status !== 201)
        throw new Error(
          `advertisement "${banner.title}" failed: ${response.status}`,
        );
      commands++;
    }
}

async function verify(client, label) {
  for (const branchId of BRANCHES) {
    const list = async (path, expected = 200) => {
      const response = await call(
        client,
        'get',
        `/api/v1/branches/${branchId}${path}`,
      );
      record(
        `${label} GET ${branchId}${path}`,
        expected,
        response.status,
        response.status === expected,
      );
      return response.body.data;
    };
    const dashboard = await list('/dashboard');
    record(
      `${label} dashboard totals present`,
      true,
      Boolean(dashboard),
      Boolean(dashboard),
    );
    await list('/reports');
    await list('/reports/export?format=csv');
    await list('/reports/export?format=excel');
    await list('/products?limit=100');
    await list('/product-categories');
    await list('/package-items');
    await list('/guarantees');
    const customers = await list('/customers?limit=100');
    if (customers?.items?.length)
      await list(`/customers/${customers.items[0]._id}`);
    const transactions = await list('/transactions?limit=100');
    if (transactions?.items?.length)
      await list(`/transactions/${transactions.items[0]._id}`);
    await list(
      '/payments?transactionId=' + (transactions?.items?.[0]?._id ?? ''),
    );
    await list(
      '/invoices?transactionId=' + (transactions?.items?.[0]?._id ?? ''),
    );
    const alterations = await list('/alterations?limit=100');
    if (alterations?.items?.length) {
      await list(`/alterations/${alterations.items[0]._id}`);
      await list(`/alterations/${alterations.items[0]._id}/receipt`);
    }
    await list('/alterations/tailors');
    await list('/expenses?limit=100');
    await list('/settings');
    await list('/messages?limit=100');
    await list('/users');
  }
  for (const [path, expected] of [
    ['/api/v1/session', 200],
    ['/api/v1/branches', 200],
    ['/api/v1/permissions', 200],
    ['/api/v1/notifications/global', 200],
    ['/api/v1/dashboard/comparison', 200],
    ['/api/v1/reports/company', 200],
    ['/api/v1/reports/company/export?format=csv', 200],
    ['/api/v1/reports/company/export?format=excel', 200],
    ['/api/v1/advertisements', 200],
  ]) {
    const response = await call(client, 'get', path);
    record(
      `${label} GET ${path}`,
      expected,
      response.status,
      response.status === expected,
    );
  }
  const publicAds = await call(client, 'get', '/api/v1/public/advertisements');
  record(
    `${label} GET public advertisements`,
    200,
    publicAds.status,
    publicAds.status === 200,
  );
}

async function main() {
  const adminEnv = parseEnv({
    ...values,
    NODE_ENV: 'development',
    HOST: '127.0.0.1',
    DEV_IDENTITY_ENABLED: 'true',
    DEV_ROLE: 'admin',
    RATE_LIMIT_MAX: '10000',
    LOG_LEVEL: 'silent',
    CORS_ORIGINS: 'http://127.0.0.1:5173',
  });
  const managerEnv = parseEnv({
    ...adminEnv,
    DEV_ROLE: 'manager',
    DEV_BRANCH_ID: 'sham-royal',
  });
  const employeeEnv = parseEnv({
    ...adminEnv,
    DEV_ROLE: 'employee',
    DEV_BRANCH_ID: 'sham-aroos',
  });
  const anonEnv = parseEnv({ ...adminEnv, DEV_IDENTITY_ENABLED: 'false' });

  await mongoose.connect(adminEnv.MONGODB_URI, { autoIndex: false });
  await initializeDatabase();

  const servers = [];
  const serve = (env) => {
    const server = http.createServer(createApp(env, () => true));
    servers.push(server);
    return new Promise((resolve) =>
      server.listen(0, '127.0.0.1', () => resolve(request(server))),
    );
  };

  try {
    const admin = await serve(adminEnv);
    for (const branchId of BRANCHES) {
      await seedBranch(admin, branchId);
      process.stdout.write(`seeded ${branchId}\n`);
    }
    await seedAdvertisements(admin);
    await verify(admin, 'admin');

    const manager = await serve(managerEnv);
    for (const [path, expected] of [
      ['/api/v1/branches/sham-royal/dashboard', 200],
      ['/api/v1/branches/sham-royal/expenses', 200],
      ['/api/v1/branches/sham-royal/alterations', 200],
      ['/api/v1/branches/sham-aroos/dashboard', 403],
      ['/api/v1/advertisements', 200],
      ['/api/v1/reports/company', 403],
      ['/api/v1/dashboard/comparison', 403],
    ]) {
      const response = await call(manager, 'get', path);
      record(
        `manager GET ${path}`,
        expected,
        response.status,
        response.status === expected,
      );
    }
    const managerAds = await call(manager, 'get', '/api/v1/advertisements');
    const foreignAds = (managerAds.body?.data ?? []).filter(
      (row) => row.branchId && row.branchId !== 'sham-royal',
    );
    record(
      'manager advertisement scope',
      'own branch and company-wide only',
      foreignAds.length
        ? `${foreignAds.length} foreign records`
        : 'no foreign records',
      foreignAds.length === 0,
    );

    const employee = await serve(employeeEnv);
    for (const [path, expected] of [
      ['/api/v1/branches/sham-aroos/dashboard', 200],
      ['/api/v1/branches/sham-aroos/expenses', 200],
      ['/api/v1/branches/sham-aroos/alterations', 200],
      ['/api/v1/branches/sham-aroos/users', 403],
      ['/api/v1/branches/sham-royal/dashboard', 403],
      ['/api/v1/advertisements', 403],
    ]) {
      const response = await call(employee, 'get', path);
      record(
        `employee GET ${path}`,
        expected,
        response.status,
        response.status === expected,
      );
    }

    const anon = await serve(anonEnv);
    for (const path of [
      '/api/v1/session',
      '/api/v1/branches',
      '/api/v1/branches/sham-royal/dashboard',
      '/api/v1/advertisements',
    ]) {
      const response = await call(anon, 'get', path);
      record(
        `anonymous GET ${path} is denied`,
        true,
        response.status >= 400,
        response.status >= 400,
      );
    }
    const publicAds = await call(anon, 'get', '/api/v1/public/advertisements');
    record(
      'anonymous GET /api/v1/public/advertisements',
      200,
      publicAds.status,
      publicAds.status === 200,
    );
  } finally {
    for (const server of servers)
      await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  }

  const passed = checks.filter((check) => check.ok).length;
  const summary = {
    anchor: new Date(anchor).toISOString(),
    commands,
    branches: BRANCHES,
    checksPassed: passed,
    checksTotal: checks.length,
    failures,
    generatedAt: new Date().toISOString(),
  };
  writeFileSync(
    new URL('seed-report.json', stateDirectory),
    JSON.stringify({ ...summary, checks }, null, 2),
  );
  console.log(
    `Seeded ${BRANCHES.length} branches with ${commands} accepted commands. Verification ${passed}/${checks.length} checks passed.`,
  );
  for (const failure of failures) console.log(`  FAILED ${failure}`);
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error('Demo seeding failed:', error.message);
  process.exitCode = 1;
});
