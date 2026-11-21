import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';
const api = 'http://127.0.0.1:4000/api/v1/branches/sham-royal';
const fixtureDevice = randomUUID();
interface RecordResult {
  _id: string;
  version: number;
  paidMinor: number;
  totalMinor: number;
  productId?: string;
  customerId: string;
  code: string;
  settings?: unknown;
  items?: RecordResult[];
}
async function command(
  request: APIRequestContext,
  action: string,
  data: unknown,
  extra: Record<string, unknown> = {},
) {
  const response = await request.post(`${api}/commands`, {
    data: {
      action,
      data,
      operationId: randomUUID(),
      deviceId: fixtureDevice,
      ...extra,
    },
  });
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()).data as RecordResult;
}
async function english(page: Page) {
  await page.goto('/dashboard');
  await page.locator('.app-topbar').waitFor();
  await page.locator('select:has(option[value="en"])').selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
}
async function navigate(page: Page, name: string) {
  const navigation = (await page.locator('.top-menubar').isVisible())
    ? page.locator('.top-menubar')
    : page.locator('.app-sidebar');
  const link = navigation.getByRole('link', {
    name,
    exact: true,
    includeHidden: true,
  });
  const group = link.locator('xpath=ancestor::details');
  if (!(await group.getAttribute('open'))) {
    // Native boolean attributes are an empty string when present.
    if (!(await group.evaluate((node) => node.hasAttribute('open'))))
      await group.locator('summary').click();
  }
  await link.click();
}
async function pickProduct(page: Page, name = 'UI Product') {
  const dialog = page.getByRole('dialog');
  const input = dialog.getByPlaceholder('Search by name or ID');
  await input.fill(name);
  await expect(dialog.locator('datalist option')).toHaveCount(1);
  const value = await dialog.locator('datalist option').getAttribute('value');
  await input.fill(value!);
}
test('company report loads from its top-level API and renders both currencies', async ({
  page,
}) => {
  await english(page);
  const responsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname === '/api/v1/reports/company' &&
      response.request().method() === 'GET'
    );
  });
  await page.goto('/reports/company');
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  await expect(page.locator('.company-report-currency')).toHaveCount(2);
  await expect(page.locator('.company-report-table tbody tr')).not.toHaveCount(
    0,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
});
let transactionId = '',
  invoiceId = '',
  customerId = '';
test.describe.configure({ mode: 'serial' });
test('expense forms and tables stay isolated across all three active branches', async ({
  page,
}) => {
  await english(page);
  const branch = page.getByRole('combobox', { name: 'Branch', exact: true });
  const branches = ['sham-royal', 'sham-aroos', 'sham-aroos-vip'];
  for (const id of branches) {
    await branch.selectOption(id);
    await navigate(page, 'Expenses');
    await page
      .getByRole('button', { name: 'New expense', exact: true })
      .click();
    const dialog = page.getByRole('dialog', { name: 'New expense' });
    await dialog
      .getByLabel('Expense name', { exact: true })
      .fill(`UI expense ${id}`);
    await dialog
      .getByLabel('Expense amount (AFN)', { exact: true })
      .fill('123.45');
    await dialog
      .getByRole('button', { name: 'Expense date', exact: true })
      .click();
    const calendar = dialog.getByRole('group');
    await calendar.getByLabel('Year', { exact: true }).fill('1405');
    await calendar
      .getByRole('combobox', { name: 'Month', exact: true })
      .selectOption('8');
    await calendar
      .getByRole('combobox', { name: 'Day', exact: true })
      .selectOption('21');
    await calendar
      .getByRole('button', { name: 'Confirm', exact: true })
      .click();
    await dialog.getByLabel('Spent by', { exact: true }).fill('UI employee');
    await dialog
      .getByLabel('Description', { exact: true })
      .fill('Office supplies');
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole('cell', { name: `UI expense ${id}`, exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('columnheader')).toHaveCount(6);
    await expect(
      page.getByRole('cell', { name: '21 Aqrab 1405', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('cell', { name: 'UI employee', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('cell', { name: /123\.45/ })).toBeVisible();
    for (const other of branches.filter((value) => value !== id))
      await expect(
        page.getByRole('cell', { name: `UI expense ${other}`, exact: true }),
      ).toHaveCount(0);
  }
  await branch.selectOption('sham-royal');
  await expect(
    page.getByRole('cell', { name: 'UI expense sham-royal', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('cell', { name: 'UI expense sham-royal', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Language', exact: true })
    .selectOption('fa-AF');
  await expect(
    page.getByRole('heading', { name: 'مصارفات', exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await expect
    .poll(() =>
      page
        .locator('.app-sidebar')
        .evaluate((node) => node.getBoundingClientRect().left >= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: '.local/print-validation/mobile-expenses-fa.png',
    fullPage: true,
  });
});
test.beforeAll(async ({ request }) => {
  await command(request, 'device.register', {
    label: 'Browser test fixture device',
  });
});
test('real product, reusable customer, rental, advance and additional payment UI', async ({
  page,
  request,
}) => {
  await english(page);
  await navigate(page, 'Products');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name', { exact: true }).fill('UI Product');
  await dialog.getByLabel('Clothing ID', { exact: true }).fill('UI-001');
  const photo = await sharp({
    create: { width: 80, height: 100, channels: 3, background: 'green' },
  })
    .png()
    .toBuffer();
  await dialog
    .locator('input[type=file]')
    .setInputFiles({ name: 'dress.png', mimeType: 'image/png', buffer: photo });
  await expect(dialog.locator('img.clothing-photo.large')).toBeVisible();
  await dialog.getByLabel('Original price (AFN)').fill('1000.25');
  await dialog.getByLabel('Product type').fill('Clothing');
  await dialog.getByLabel('Brand').fill('UI Brand');
  await dialog.getByLabel('Color').fill('Blue');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('cell', { name: 'UI Product', exact: true }),
  ).toBeVisible();
  await expect(page.locator('tbody img.clothing-photo').first()).toBeVisible();

  await navigate(page, 'Customers');
  await page.getByRole('button', { name: 'New customer', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Full name').fill('UI Customer');
  await dialog.getByLabel('Telephone', { exact: true }).fill('0701234567');
  await dialog.getByLabel('WhatsApp').fill('0701234567');
  await expect(dialog.getByLabel('Full name')).toBeVisible();
  await expect(dialog.getByLabel('Product', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('dialog', { name: 'New customer' }),
  ).toBeVisible();
  await pickProduct(page);
  dialog = page.getByRole('dialog');
  await expect(dialog.getByText('UI Brand', { exact: false })).toBeVisible();
  await dialog.getByLabel('Agreed base price (AFN)').fill('100.10');
  await dialog.getByLabel('Advance payment (AFN)').fill('10.00');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/\/transactions\/[a-f0-9-]+$/);
  transactionId = page.url().split('/').at(-1)!;
  await expect(page.locator('.stats-grid').getByText(/90\.10/)).toBeVisible();
  await page
    .getByRole('button', { name: 'Record payment', exact: true })
    .click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Payment amount (AFN)').fill('20.05');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.stats-grid').getByText(/70\.05/)).toBeVisible();
  const stored = await (
    await request.get(`${api}/transactions/${transactionId}`)
  ).json();
  expect(stored.data.paidMinor).toBe(3005);
  expect(stored.data.payments).toHaveLength(2);
  customerId = stored.data.customerId;
  await page
    .getByRole('button', { name: 'Print receipt', exact: true })
    .first()
    .click();
  await expect(page.locator('.print-sheets .bill-receipt')).toHaveCount(2);
  await expect(page.locator('.print-sheets').first()).toContainText(
    stored.data.payments[0].code,
  );
  await page.goto(`/transactions/${transactionId}`);
  await page.getByRole('button', { name: 'Print bill', exact: true }).click();
  await expect(page).toHaveURL(/\/print\//);
  invoiceId = new URL(page.url()).pathname.split('/').at(-1)!;
  await expect(page.locator('.print-sheets .invoice-paper')).toHaveCount(2);
  mkdirSync('.local/print-validation', { recursive: true });
  await page.pdf({
    path: '.local/print-validation/invoice-copies-a4.pdf',
    preferCSSPageSize: true,
    printBackground: true,
  });
  await page
    .getByRole('combobox', { name: 'Print preview' })
    .selectOption('one');
  await expect(page.locator('.print-sheets .invoice-paper')).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: 'Print / Save PDF' }),
  ).toBeEnabled();
  mkdirSync('.local/print-validation', { recursive: true });
  await page.pdf({
    path: '.local/print-validation/invoice-a5.pdf',
    preferCSSPageSize: true,
    printBackground: true,
  });
  await page.screenshot({
    path: '.local/print-validation/invoice-preview.png',
    fullPage: true,
  });
});
test('two distinct invoices fit as rotated A5 sheets on one A4 page', async ({
  page,
  request,
}) => {
  const secondProduct = await command(
    request,
    'catalog.create',
    { name: 'Second invoice dress', clothingId: 'SECOND-001', price: '200' },
    { resource: 'products' },
  );
  const secondTransaction = await command(request, 'transaction.create', {
    customerId,
    productId: secondProduct._id,
    type: 'purchase',
    agreedPrice: '200',
    advance: '0',
    reservationAt: new Date(Date.now() + 86400000).toISOString(),
  });
  const secondInvoice = await command(request, 'invoice.issue', {
    transactionId: secondTransaction._id,
  });
  await english(page);
  await page.goto(`/print/${invoiceId}`);
  await page
    .getByRole('combobox', { name: 'Print preview' })
    .selectOption('two');
  await page.getByLabel('Print two copies of this invoice').uncheck();
  await page.getByLabel('Second invoice ID').fill(secondInvoice._id);
  await page.getByRole('button', { name: 'View', exact: true }).click();
  await expect(page.locator('.print-sheets .invoice-paper')).toHaveCount(2);
  const ids = await page
    .locator('.print-sheets .invoice-paper')
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('data-invoice-id')),
    );
  expect(new Set(ids).size).toBe(2);
  const sizes = await page
    .locator('.print-sheets .invoice-paper')
    .evaluateAll((nodes) =>
      nodes.map((node) => ({
        width: node.getBoundingClientRect().width,
        height: node.getBoundingClientRect().height,
        overflow: node.scrollHeight > node.clientHeight + 2,
      })),
    );
  for (const size of sizes) {
    expect(size.width).toBeCloseTo((210 * 96) / 25.4, 0);
    expect(size.height).toBeCloseTo((148 * 96) / 25.4, 0);
    expect(size.overflow).toBe(false);
  }
  await page.pdf({
    path: '.local/print-validation/invoices-a4.pdf',
    preferCSSPageSize: true,
    printBackground: true,
  });
});
test('Dari, Pashto, English, persistent preferences and mobile containment', async ({
  page,
}) => {
  await english(page);
  const language = page.locator('select:has(option[value="en"])');
  await language.selectOption('fa-AF');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('.app-sidebar')).toContainText('مشتریان');
  await language.selectOption('ps-AF');
  await expect(page.locator('.app-sidebar')).toContainText('پېرودونکي');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ps-AF');
  await page.locator('select:has(option[value="en"])').selectOption('en');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page
    .getByRole('button', { name: 'Open navigation', exact: true })
    .click();
  await page
    .locator('.app-sidebar')
    .getByRole('link', { name: 'Customers', exact: true })
    .click();
  await expect(
    page.getByRole('link', { name: 'UI Customer', exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await expect
    .poll(() =>
      page
        .locator('.app-sidebar')
        .evaluate((node) => node.getBoundingClientRect().right),
    )
    .toBeLessThanOrEqual(0);
  await page.screenshot({
    path: '.local/print-validation/mobile-customers.png',
    fullPage: true,
  });
});
test('offline customer, transaction and payment survive reload and synchronize once', async ({
  page,
  context,
  request,
}) => {
  await command(
    request,
    'catalog.create',
    { name: 'Offline available dress', clothingId: 'OFF-001', price: '50' },
    { resource: 'products' },
  );
  const settings = (await (await request.get(`${api}/settings`)).json()).data;
  await command(request, 'settings.update', {
    expectedVersion: settings.version,
    currency: 'AFN',
    paymentMethods: ['cash', 'bank'],
    offlinePayments: true,
    offlinePaymentLimit: '100',
    companyName: settings.companyName,
    address: settings.address,
    telephone: settings.telephone,
  });
  await english(page);
  await navigate(page, 'Branch settings');
  await expect(page.getByLabel('Offline payment limit (AFN)')).toHaveValue(
    '100.00',
  );
  await navigate(page, 'Products');
  await expect(
    page.getByRole('cell', { name: 'UI Product', exact: true }),
  ).toBeVisible();
  await navigate(page, 'Customers');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.locator('.app-topbar')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.getByRole('button', { name: 'New customer', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Full name').fill('Offline Customer');
  await dialog.getByLabel('Telephone', { exact: true }).fill('0709990000');
  await expect(dialog.getByLabel('Full name')).toBeVisible();
  await expect(dialog.getByLabel('Product', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('dialog', { name: 'New customer' }),
  ).toBeVisible();
  await pickProduct(page, 'Offline available dress');
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Agreed base price (AFN)').fill('50');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/\/transactions\//);
  const offlineId = page.url().split('/').at(-1)!;
  await expect(page.locator('.notice')).toContainText('Provisional');
  await page.reload();
  await expect(page.locator('.notice')).toContainText('Provisional');
  await page
    .getByRole('button', { name: 'Record payment', exact: true })
    .click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Payment amount (AFN)').fill('10.20');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.stats-grid').getByText(/39\.80/)).toBeVisible();
  await context.setOffline(false);
  await expect
    .poll(
      async () => {
        const response = await request.get(`${api}/transactions/${offlineId}`);
        if (!response.ok()) return -1;
        return (await response.json()).data.paidMinor;
      },
      { timeout: 30000 },
    )
    .toBe(1020);
  await page.reload();
  await expect(page.locator('.notice')).toHaveCount(0);
  const record = (
    await (await request.get(`${api}/transactions/${offlineId}`)).json()
  ).data;
  expect(record.payments).toHaveLength(1);
});
test('an independent device payment produces a reviewable offline conflict', async ({
  page,
  context,
  browser,
  request,
}) => {
  await english(page);
  await page.goto(`/transactions/${transactionId}`);
  await expect(
    page.getByRole('button', { name: 'Record payment', exact: true }),
  ).toBeVisible();
  await page.goto('/settings');
  await expect(page.getByLabel('Offline payment limit (AFN)')).toBeVisible();
  await page.goto(`/transactions/${transactionId}`);
  await expect(page.locator('.stats-grid')).toBeVisible();
  await context.setOffline(true);
  await page
    .getByRole('button', { name: 'Record payment', exact: true })
    .click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Payment amount (AFN)').fill('5');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.notice')).toBeVisible();
  const other = await browser.newContext();
  const second = await other.newPage();
  await english(second);
  await second.goto(`/transactions/${transactionId}`);
  await second
    .getByRole('button', { name: 'Record payment', exact: true })
    .click();
  dialog = second.getByRole('dialog');
  await dialog.getByLabel('Payment amount (AFN)').fill('1');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const firstDevice = await page.evaluate(() =>
    localStorage.getItem('myt-device-id'),
  );
  const secondDevice = await second.evaluate(() =>
    localStorage.getItem('myt-device-id'),
  );
  expect(firstDevice).not.toBe(secondDevice);
  await other.close();
  await context.setOffline(false);
  await page.goto('/sync');
  await expect(
    page.getByText('Conflict requires review', { exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Review against server' }).click();
  await expect(page.getByRole('dialog')).toContainText('5');
  await page
    .getByRole('button', {
      name: 'Submit reviewed amount against current balance',
    })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect
    .poll(
      async () => {
        const result = await (
          await request.get(`${api}/transactions/${transactionId}`)
        ).json();
        return result.data.paidMinor;
      },
      { timeout: 30000 },
    )
    .toBe(3605);
});

test('four branch cards, atomic USD registration, account navigation and long paired continuations', async ({
  page,
  request,
}) => {
  await english(page);
  await page
    .getByRole('combobox', { name: 'Company overview', exact: true })
    .selectOption('all');
  await expect(page.locator('.branch-comparison article')).toHaveCount(4);
  const dollarCard = page
    .locator('.branch-comparison article')
    .filter({ hasText: 'Dollar Department' });
  await dollarCard.getByRole('button', { name: 'View', exact: true }).click();
  await expect(
    page
      .locator('.app-topbar')
      .getByRole('combobox', { name: 'Branch', exact: true }),
  ).toHaveValue('dollar');
  await navigate(page, 'Customers');
  await navigate(page, 'Overview');
  await expect(page.locator('.branch-comparison article')).toHaveCount(4);
  await page
    .locator('.branch-comparison article')
    .filter({ hasText: 'Dollar Department' })
    .getByRole('button', { name: 'View', exact: true })
    .click();
  const root = 'http://127.0.0.1:4000/api/v1/branches/dollar';
  async function usd(action: string, data: unknown, extra = {}) {
    const response = await request.post(root + '/commands', {
      data: {
        action,
        data,
        operationId: randomUUID(),
        deviceId: fixtureDevice,
        ...extra,
      },
    });
    expect(response.status(), await response.text()).toBe(200);
    return (await response.json()).data;
  }
  await usd('device.register', { label: 'USD browser fixture' });
  const product = await usd(
    'catalog.create',
    { name: 'USD product', clothingId: 'USD-UI', price: '1000' },
    { resource: 'products' },
  );
  await navigate(page, 'Customers');
  await page.getByRole('button', { name: 'New customer', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Full name').fill('USD customer');
  await dialog.getByLabel('Telephone', { exact: true }).fill('0701112222');
  await expect(dialog.getByLabel('Full name')).toBeVisible();
  await expect(dialog.getByLabel('Product', { exact: true })).toBeVisible();
  await pickProduct(page, 'USD product');
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Advance payment (USD)').fill('300');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/transactions\/[a-f0-9-]+$/);
  await expect(page.locator('.stats-grid')).toContainText('700.00');
  const transactionId = new URL(page.url()).pathname.split('/').at(-1)!;
  const transaction = (
    await (await request.get(root + '/transactions/' + transactionId)).json()
  ).data;
  expect(transaction.currency).toBe('USD');
  expect(transaction.product.id).toBe(product._id);
  await navigate(page, 'Customers');
  await page
    .getByRole('row')
    .filter({ hasText: 'USD customer' })
    .getByRole('cell', { name: '0701112222', exact: true })
    .click();
  await expect(page).toHaveURL(
    new RegExp('/customers/' + transaction.customerId),
  );
  await expect(page.locator('.stats-grid')).toContainText('USD');
  await usd(
    'customer.update',
    {
      fullName: '\u0645\u0634\u062a\u0631\u06cc '.repeat(20),
      telephone: '0701112222',
    },
    { targetId: transaction.customerId, expectedVersion: 1 },
  );
  const packageRows = [];
  for (let index = 0; index < 20; index++) {
    const item = await usd(
      'catalog.create',
      { name: 'Continuation item ' + index, price: '10' },
      { resource: 'package-items' },
    );
    packageRows.push({ itemId: item._id, quantity: index + 1 });
  }
  const otherProduct = await usd(
    'catalog.create',
    { name: 'Long invoice item', clothingId: 'USD-LONG', price: '1000' },
    { resource: 'products' },
  );
  const long = await usd('transaction.create', {
    customerId: transaction.customerId,
    productId: otherProduct._id,
    type: 'purchase',
    agreedPrice: '1000000',
    advance: '0',
    packages: packageRows,
    reservationAt: new Date().toISOString(),
    notes:
      '\u06cc\u0627\u062f\u062f\u0627\u0634\u062a \u062f\u0631\u06cc - ' +
      'Long invoice notes with all content preserved. '.repeat(40),
  });
  const invoice = await usd('invoice.issue', { transactionId: long._id });
  await page.goto('/print/' + invoice._id);
  await expect.poll(() => page.locator('.a4-page').count()).toBeGreaterThan(1);
  const sheets = page.locator('.a4-page');
  for (let index = 0; index < (await sheets.count()); index++) {
    const papers = sheets.nth(index).locator('.invoice-paper');
    await expect(papers).toHaveCount(2);
    expect(await papers.nth(0).innerText()).toBe(
      await papers.nth(1).innerText(),
    );
  }
  const content = page.locator('.print-sheets');
  await expect(content).toContainText('Continuation item 19');
  expect(
    await content
      .locator('.invoice-paper')
      .evaluateAll((nodes) =>
        nodes.every((node) => node.scrollHeight <= node.clientHeight + 2),
      ),
  ).toBe(true);
  await page.pdf({
    path: '.local/print-validation/long-paired-a4.pdf',
    preferCSSPageSize: true,
    printBackground: true,
  });
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.print = () => {
      document.body.dataset.printInvoked = 'true';
    };
  });
});

test('new customer shows the complete registration form immediately in every active branch', async ({
  page,
}) => {
  await english(page);
  await page
    .getByRole('button', { name: 'Navigation layout', exact: true })
    .click();
  await page.getByRole('button', { name: 'Color theme', exact: true }).click();
  for (const branchId of [
    'sham-royal',
    'sham-aroos',
    'sham-aroos-vip',
    'dollar',
  ]) {
    await page
      .locator('.app-topbar')
      .getByRole('combobox', { name: 'Branch', exact: true })
      .selectOption(branchId);
    await navigate(page, 'Customers');
    await page
      .getByRole('button', { name: 'New customer', exact: true })
      .click();
    const dialog = page.getByRole('dialog', {
      name: 'New customer',
      exact: true,
    });
    for (const label of ['Full name', 'Telephone', 'WhatsApp', 'Product'])
      await expect(dialog.getByLabel(label, { exact: true })).toHaveCount(1);
    await expect(dialog.getByLabel('Full name')).toHaveValue('');
    await expect(
      dialog.getByRole('button', {
        name: 'Continue to transaction',
        exact: true,
      }),
    ).toHaveCount(0);
    const currency = branchId === 'dollar' ? 'USD' : 'AFN';
    await expect(
      dialog.getByLabel(`Advance payment (${currency})`),
    ).toHaveCount(1);
    await expect(
      dialog.getByRole('button', { name: 'Save', exact: true }),
    ).toBeDisabled();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    if (branchId === 'dollar') {
      mkdirSync('.local/customer-validation', { recursive: true });
      await page.screenshot({
        path: '.local/customer-validation/unified-mobile.png',
        fullPage: true,
      });
    }
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page.setViewportSize({ width: 1280, height: 900 });
  }
});

test('reference shell preserves themes, navigation modes and every permitted module', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await english(page);
  for (const language of ['fa-AF', 'ps-AF', 'en']) {
    await page
      .locator('.app-topbar select:has(option[value="en"])')
      .selectOption(language);
    for (const width of [320, 390, 768, 820, 1024, 1280, 1366, 1440, 1672]) {
      await page.setViewportSize({ width, height: 960 });
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
      if (width > 800) {
        const header = await page.locator('.app-topbar').boundingBox();
        expect(header?.x).toBe(0);
        expect(header?.width).toBe(width);
        const search = await page.locator('.workspace-search').boundingBox();
        const actions = await page.locator('.topbar-end').boundingBox();
        expect((search?.x || 0) + (search?.width || 0)).toBeLessThanOrEqual(
          actions?.x || 0,
        );
      }
    }
  }
  await page.getByRole('button', { name: 'Color theme', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page
    .getByRole('button', { name: 'Navigation layout', exact: true })
    .click();
  await expect(page.locator('.top-menubar')).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.top-menubar')).toBeVisible();
  const routes = [
    '/customers',
    '/transactions',
    '/products',
    '/product-categories',
    '/guarantees',
    '/package-items',
    '/expenses',
    '/users',
    '/sessions',
    '/notifications',
    '/reports',
    '/audit-logs',
    '/settings',
    '/sync',
  ];
  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator('.app-topbar')).toBeVisible();
    await expect(page.locator('.app-content')).not.toBeEmpty();
    await expect(page.locator('.app-content .skeleton')).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
  }
  await page.getByRole('button', { name: 'Color theme', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page
    .getByRole('button', { name: 'Navigation layout', exact: true })
    .click();
  await expect(page.locator('.app-sidebar')).toBeVisible();
  await page.goto('/dashboard');
  await expect(page.locator('.branch-comparison > article')).toHaveCount(4);
  await page.setViewportSize({ width: 1366, height: 900 });
  await page
    .locator('.app-topbar select:has(option[value="en"])')
    .selectOption('fa-AF');
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(() => document.fonts.check('600 16px Vazirmatn')),
  ).toBe(true);
  await page.locator('.profile-dropdown > summary').click();
  const profile = await page.locator('.profile-menu').boundingBox();
  expect(profile?.x).toBeGreaterThanOrEqual(0);
  expect((profile?.x || 0) + (profile?.width || 0)).toBeLessThanOrEqual(1366);
  await page.keyboard.press('Escape');
  await page.screenshot({
    path: '.local/print-validation/reference-dashboard.png',
    fullPage: false,
  });
});

test('today, both currencies, combined customer filters and row bills work in all four branches', async ({
  page,
  request,
}) => {
  test.setTimeout(180000);
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  await english(page);
  await page.addInitScript(() => {
    window.print = () => {};
  });
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kabul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const midnight = new Date(`${today}T00:00:00+04:30`).toISOString();
  for (const branch of [
    'sham-royal',
    'sham-aroos',
    'sham-aroos-vip',
    'dollar',
  ]) {
    await page
      .locator('.app-topbar')
      .getByRole('combobox', { name: 'Branch', exact: true })
      .selectOption(branch);
    const root = `http://127.0.0.1:4000/api/v1/branches/${branch}`;
    async function scoped(action: string, data: unknown, extra = {}) {
      const response = await request.post(root + '/commands', {
        data: {
          action,
          data,
          deviceId: fixtureDevice,
          operationId: randomUUID(),
          ...extra,
        },
      });
      expect(response.status(), await response.text()).toBe(200);
      return (await response.json()).data;
    }
    await scoped('device.register', { label: 'Phase one browser' });
    for (const currency of ['AFN', 'USD']) {
      const name = `Phase one ${branch} ${currency}`;
      await scoped(
        'catalog.create',
        {
          clothingId: `P1-${branch}-${currency}`,
          name,
          currency,
          price: '100',
        },
        { resource: 'products' },
      );
      await page.goto('/customers');
      await page
        .getByRole('button', { name: 'New customer', exact: true })
        .click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('Full name', { exact: true }).fill(name);
      await dialog.getByLabel('Telephone', { exact: true }).fill('0700000999');
      await pickProduct(page, name);
      await expect(dialog.getByLabel('Currency', { exact: true })).toHaveValue(
        currency,
      );
      await dialog
        .getByRole('button', {
          name: 'Reservation / collection date',
          exact: true,
        })
        .click();
      await dialog
        .getByRole('group')
        .getByRole('button', { name: 'Confirm', exact: true })
        .click();
      await dialog
        .getByLabel(`Advance payment (${currency})`, { exact: true })
        .fill('10');
      await dialog.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(page).toHaveURL(/transactions\/[a-f0-9-]+$/);
      const id = new URL(page.url()).pathname.split('/').at(-1)!;
      const transaction = (
        await (await request.get(root + '/transactions/' + id)).json()
      ).data;
      expect(transaction.currency).toBe(currency);
      expect(transaction.reservationAt).toBe(midnight);
      await page.reload();
      await expect(page.locator('.stats-grid')).toContainText('90.00');
      await page.goto('/customers');
      const filters = page.locator('.customer-filters');
      await filters.getByRole('textbox').fill(name);
      await filters
        .getByRole('combobox', { name: 'Transaction type', exact: true })
        .selectOption(transaction.type);
      await filters
        .getByRole('combobox', { name: 'Delivery status', exact: true })
        .selectOption('pending');
      await filters
        .getByRole('combobox', { name: 'Custom range', exact: true })
        .selectOption('today');
      await filters
        .getByRole('combobox', { name: 'Sort by', exact: true })
        .selectOption('fullName');
      await filters
        .getByRole('combobox', { name: 'Sort direction', exact: true })
        .selectOption('asc');
      const row = page.getByRole('row').filter({ hasText: name });
      await expect(row).toHaveCount(1);
      await expect(
        row
          .locator('td')
          .first()
          .getByRole('button', { name: 'Print bill', exact: true }),
      ).toBeVisible();
      await row
        .getByRole('button', { name: 'Print bill', exact: true })
        .click();
      await expect(page).toHaveURL(/\/print\/[a-f0-9-]+/);
      const invoiceId = new URL(page.url()).pathname.split('/').at(-1)!;
      const invoice = (
        await (await request.get(root + '/invoices/' + invoiceId)).json()
      ).data;
      expect(invoice.transactionId).toBe(id);
      expect(invoice.customerId).toBe(transaction.customerId);
      expect(invoice.snapshot.transaction.currency).toBe(currency);
      await expect(page.locator('.invoice-paper').first()).toContainText(name);
      await page.goto('/customers');
      await page
        .locator('.customer-filters')
        .getByRole('textbox')
        .fill('no matching phase one customer');
      await expect(page.locator('.customer-account-row')).toHaveCount(0);
      await page
        .locator('.customer-filters')
        .getByRole('button', { name: 'Clear filters', exact: true })
        .click();
      await expect(page.locator('.customer-account-row').first()).toBeVisible();
    }
    await page.goto('/expenses');
    await page
      .getByRole('button', { name: 'New expense', exact: true })
      .click();
    await page
      .getByRole('dialog')
      .getByLabel('Currency', { exact: true })
      .selectOption('USD');
    await expect(
      page
        .getByRole('dialog')
        .getByLabel('Expense amount (USD)', { exact: true }),
    ).toBeVisible();
    const expenseDialog = page.getByRole('dialog');
    await expenseDialog
      .getByLabel('Expense name', { exact: true })
      .fill(`Phase one expense ${branch}`);
    await expenseDialog
      .getByLabel('Expense amount (USD)', { exact: true })
      .fill('12.34');
    await expenseDialog
      .getByLabel('Spent by', { exact: true })
      .fill('Browser fixture');
    await expenseDialog
      .getByRole('button', { name: 'Save', exact: true })
      .click();
    await expect(expenseDialog).toHaveCount(0);
    const expenses = (
      await (
        await request.get(
          root +
            '/expenses?q=' +
            encodeURIComponent(`Phase one expense ${branch}`),
        )
      ).json()
    ).data.items;
    expect(expenses[0]).toMatchObject({ currency: 'USD', amountMinor: 1234 });
    await page.goto('/products');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page
      .getByRole('dialog')
      .getByLabel('Currency', { exact: true })
      .selectOption('USD');
    await expect(
      page
        .getByRole('dialog')
        .getByLabel('Original price (USD)', { exact: true }),
    ).toBeVisible();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Cancel', exact: true })
      .click();
    await page.goto('/reports');
    await page.getByLabel('Currency', { exact: true }).selectOption('USD');
    await expect(page.locator('.stats-grid')).toContainText('$');
  }
  await page.goto('/customers');
  await page
    .getByRole('combobox', { name: 'Language', exact: true })
    .selectOption('fa-AF');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.locator('.customer-filters').screenshot({
    path: '.local/print-validation/customer-filters-phase1-rtl.png',
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(failures).toEqual([]);
});

test('an oversized package total shows validation and keeps customer registration usable', async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await command(
    request,
    'catalog.create',
    {
      name: 'Overflow review dress',
      clothingId: 'OVERFLOW-REVIEW',
      price: '10',
    },
    { resource: 'products' },
  );
  await command(
    request,
    'catalog.create',
    { name: 'Overflow review package', price: '999999999', quantity: 1 },
    { resource: 'package-items' },
  );
  await english(page);
  await page.goto('/customers?new');
  const dialog = page.getByRole('dialog');
  await pickProduct(page, 'Overflow review dress');
  await dialog
    .getByRole('button', { name: 'Add package items', exact: true })
    .click();
  await dialog
    .locator('.package-option')
    .filter({ hasText: 'Overflow review package' })
    .getByRole('checkbox')
    .check();
  await dialog
    .getByRole('spinbutton', {
      name: 'Quantity Overflow review package',
      exact: true,
    })
    .fill('1000');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.field-error')).not.toHaveCount(0);
  await expect(
    dialog.getByRole('button', { name: 'Save', exact: true }),
  ).toBeDisabled();
  await dialog
    .getByRole('spinbutton', {
      name: 'Quantity Overflow review package',
      exact: true,
    })
    .fill('1');
  await expect(
    dialog.getByRole('button', { name: 'Save', exact: true }),
  ).toBeEnabled();
  expect(errors).toEqual([]);
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
});
