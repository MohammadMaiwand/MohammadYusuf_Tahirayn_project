import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';
import mongoose from 'mongoose';
const base = 'http://127.0.0.1:4000/api/v1';
const deviceId = randomUUID();
async function command(
  request: APIRequestContext,
  branch: string,
  action: string,
  data: unknown,
  extra = {},
) {
  const response = await request.post(`${base}/branches/${branch}/commands`, {
    data: { action, data, deviceId, operationId: randomUUID(), ...extra },
  });
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()).data;
}
async function english(page: Page) {
  await page.goto('/dashboard');
  await page.locator('.app-topbar').waitFor();
  await page.locator('select:has(option[value="en"])').selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
}
const offsetDay = (offset: number) => new Date(Date.now() + offset * 86400000);
async function pickDate(page: Page, label: string, date: Date) {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', {
    timeZone: 'Asia/Kabul',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date);
  const part = (key: string) => parts.find((row) => row.type === key)!.value;
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: label, exact: true }).click();
  const picker = dialog.getByRole('group');
  await picker.getByLabel('Year', { exact: true }).fill(part('year'));
  await picker
    .getByRole('combobox', { name: 'Month', exact: true })
    .selectOption(part('month'));
  await picker
    .getByRole('combobox', { name: 'Day', exact: true })
    .selectOption(part('day'));
  await picker.getByRole('button', { name: 'Confirm', exact: true }).click();
}
async function reconcile() {
  const database = process.env.MYT_UI_DATABASE;
  if (!database || !/^myt_ui_test_[a-f0-9]{32}$/.test(database))
    throw new Error('Unsafe fixture database refused');
  const path = '../../backend/dist/modules/alterations/scheduler.js';
  const { reconcileAlterations } = await import(path);
  await mongoose.connect('mongodb://127.0.0.1:27018/?replicaSet=myt-dev', {
    dbName: database,
    autoCreate: false,
    autoIndex: false,
  });
  try {
    await reconcileAlterations(new Date());
    await reconcileAlterations(new Date());
  } finally {
    await mongoose.disconnect();
  }
}
test('customer and transaction alterations preserve prices, edit photos/status and print a real receipt', async ({
  page,
  request,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await command(request, 'sham-royal', 'device.register', {
    label: 'Alteration browser',
  });
  const customer = await command(request, 'sham-royal', 'customer.create', {
    fullName: 'Alteration UI customer',
    telephone: '0701234567',
    whatsapp: '0709876543',
  });
  const product = await command(
    request,
    'sham-royal',
    'catalog.create',
    {
      clothingId: 'ALT-UI-PRODUCT',
      name: 'Alteration fixture garment',
      productType: 'Bridal',
      brand: 'MYT fixture',
      color: 'Emerald',
      price: '500',
      currency: 'AFN',
    },
    { resource: 'products' },
  );
  const transaction = await command(
    request,
    'sham-royal',
    'transaction.create',
    {
      customerId: customer._id,
      productId: product._id,
      type: 'purchase',
      agreedPrice: '450',
      currency: 'AFN',
      reservationAt: new Date().toISOString(),
    },
  );
  await english(page);
  await page.goto('/customers/' + customer._id);
  await page
    .getByRole('tab', { name: 'Garment Alterations', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'New alteration', exact: true })
    .click();
  let dialog = page.getByRole('dialog');
  await expect(dialog.locator('.customer-strip')).toContainText(
    customer.fullName,
  );
  await dialog
    .getByLabel('Transactions', { exact: true })
    .selectOption(transaction._id);
  await dialog.getByLabel('Garment ID', { exact: true }).fill('ALT-UI-001');
  await expect(
    dialog.getByLabel('Original price', { exact: true }),
  ).toHaveValue('500.00');
  await expect(
    dialog.getByLabel('Original price', { exact: true }),
  ).toHaveAttribute('readonly', '');
  await dialog
    .getByLabel('Alteration description', { exact: true })
    .fill('Adjust waist and sleeves');
  await dialog
    .getByLabel('Alteration type', { exact: true })
    .selectOption('waist');
  await dialog.getByLabel('Currency', { exact: true }).selectOption('USD');
  await dialog.getByLabel('Alteration charge', { exact: true }).fill('15.25');
  await dialog
    .getByRole('combobox', { name: 'Tailor name', exact: true })
    .fill('UI tailor');
  await pickDate(page, 'Alteration start date', offsetDay(0));
  await pickDate(page, 'Expected delivery date', offsetDay(2));
  await expect(dialog.locator('.totals-box')).toContainText('2 days');
  const photo = await sharp({
    create: { width: 60, height: 80, channels: 3, background: '#216b53' },
  })
    .png()
    .toBuffer();
  await dialog.locator('input[type=file]').setInputFiles({
    name: 'alteration.png',
    mimeType: 'image/png',
    buffer: photo,
  });
  await expect(dialog.locator('img.clothing-photo')).toBeVisible();
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/\/alterations\/[a-f0-9-]+$/);
  const id = new URL(page.url()).pathname.split('/').at(-1)!;
  const row = (
    await (
      await request.get(`${base}/branches/sham-royal/alterations/${id}`)
    ).json()
  ).data;
  expect(row).toMatchObject({
    customerId: customer._id,
    transactionId: transaction._id,
    garmentId: 'ALT-UI-001',
    originalMinor: 50000,
    originalCurrency: 'AFN',
    alterationMinor: 1525,
    currency: 'USD',
    durationDays: 2,
  });
  expect(row.photoId).toBeTruthy();
  await expect(page.locator('.alteration-details')).toContainText('USD');
  await page.reload();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('Alteration description', { exact: true })
    .fill('Updated waist adjustment');
  await dialog
    .getByRole('button', { name: 'Remove image', exact: true })
    .click();
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.alteration-details')).toContainText(
    'Updated waist adjustment',
  );
  await page
    .getByRole('combobox', { name: 'Status', exact: true })
    .selectOption('in_progress');
  await page
    .getByRole('button', { name: 'Update status', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Confirm', exact: true })
    .click();
  await expect(page.locator('.alteration-details')).toContainText(
    'In progress',
  );
  await page.goto('/alterations');
  await page
    .locator('.alterations-module')
    .getByRole('textbox', { name: 'Garment ID', exact: true })
    .fill('ALT-UI-001');
  await expect(
    page.getByRole('row').filter({ hasText: 'ALT-UI-001' }),
  ).toHaveCount(1);
  await expect(page.getByRole('columnheader')).toHaveCount(17);
  await page
    .getByRole('row')
    .filter({ hasText: 'ALT-UI-001' })
    .getByRole('link', { name: 'View', exact: true })
    .click();
  await page
    .getByRole('link', { name: 'Print alteration receipt', exact: true })
    .click();
  await expect(page.locator('.alteration-receipt')).toContainText(
    customer.fullName,
  );
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.app-topbar')).toBeHidden();
  mkdirSync('.local/alteration-validation', { recursive: true });
  await page.pdf({
    path: '.local/alteration-validation/alteration-receipt.pdf',
    preferCSSPageSize: true,
    printBackground: true,
  });
  await page
    .locator('.alteration-receipt')
    .screenshot({ path: '.local/alteration-validation/receipt.png' });
  await page.emulateMedia({ media: 'screen' });
  await page.goto('/transactions/' + transaction._id);
  await expect(page.locator('.alterations-module')).toContainText('ALT-UI-001');
  const original = (
    await (
      await request.get(
        `${base}/branches/sham-royal/transactions/${transaction._id}`,
      )
    ).json()
  ).data;
  expect(original).toMatchObject({ totalMinor: 45000, currency: 'AFN' });
  expect(original.product.originalMinor).toBe(50000);
  expect(errors).toEqual([]);
});
test('independent alterations work in every branch and durable reminders open the correct record from another branch', async ({
  page,
  request,
}) => {
  test.setTimeout(120000);
  await english(page);
  let reminderId = '',
    reminderCustomerId = '';
  for (const branch of [
    'sham-royal',
    'sham-aroos',
    'sham-aroos-vip',
    'dollar',
  ]) {
    await command(request, branch, 'device.register', {
      label: 'Alteration independent fixture',
    });
    const customer = await command(request, branch, 'customer.create', {
      fullName: 'Independent alteration ' + branch,
      telephone: '0700000222',
    });
    await page
      .locator('.app-topbar')
      .getByRole('combobox', { name: 'Branch', exact: true })
      .selectOption(branch);
    await page.goto('/alterations');
    await page
      .getByRole('button', { name: 'New alteration', exact: true })
      .click();
    const dialog = page.getByRole('dialog');
    await dialog
      .getByRole('textbox', { name: 'Search by name or ID', exact: true })
      .fill(customer.fullName);
    await dialog
      .getByLabel('Customer', { exact: true })
      .selectOption(customer._id);
    await expect(dialog.getByLabel('Customer', { exact: true })).toHaveValue(
      customer._id,
    );
    await dialog
      .getByLabel('Garment ID', { exact: true })
      .fill('INDEPENDENT-ALT');
    await dialog
      .getByLabel('Garment name', { exact: true })
      .fill('Independent dress');
    await dialog.getByLabel('Garment type', { exact: true }).fill('Evening');
    await dialog
      .getByLabel('Alteration description', { exact: true })
      .fill('Repair stitching');
    await dialog.getByLabel('Currency', { exact: true }).selectOption('USD');
    await dialog
      .getByLabel('Original price currency', { exact: true })
      .selectOption('AFN');
    await dialog.getByLabel('Original price', { exact: true }).fill('5000');
    await dialog.getByLabel('Alteration charge', { exact: true }).fill('10');
    await dialog
      .getByRole('combobox', { name: 'Tailor name', exact: true })
      .fill('Independent tailor');
    await pickDate(page, 'Alteration start date', offsetDay(0));
    await pickDate(page, 'Expected delivery date', offsetDay(1));
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page).toHaveURL(/\/alterations\/[a-f0-9-]+$/);
    const id = new URL(page.url()).pathname.split('/').at(-1)!;
    if (branch === 'sham-royal') {
      reminderId = id;
      reminderCustomerId = customer._id;
    }
    const other = branch === 'sham-royal' ? 'sham-aroos' : 'sham-royal';
    expect(
      (
        await request.get(`${base}/branches/${other}/alterations/${id}`)
      ).status(),
    ).toBe(404);
    await page.goto('/alterations');
    await expect(
      page.getByRole('row').filter({ hasText: 'INDEPENDENT-ALT' }),
    ).toHaveCount(1);
  }
  await reconcile();
  const notifications = (
    await (await request.get(base + '/notifications/global')).json()
  ).data as {
    amountMinor?: string;
    alterationId?: string;
    currency?: string;
    managementOnly?: boolean;
    deliveryStatus?: string;
  }[];
  expect(
    notifications.filter((row) => row.alterationId === reminderId),
  ).toHaveLength(1);
  expect(
    notifications.find((row) => row.alterationId === reminderId),
  ).toMatchObject({
    amountMinor: '1000',
    currency: 'USD',
    managementOnly: true,
    deliveryStatus: 'available',
  });
  await page
    .locator('.app-topbar')
    .getByRole('combobox', { name: 'Branch', exact: true })
    .selectOption('sham-aroos');
  await page.goto('/notifications');
  const card = page
    .locator('.notifications-card')
    .filter({ hasText: 'Independent alteration sham-royal' });
  await expect(card).toContainText('$10.00');
  await expect(card).toHaveClass(/is-(soon|later)/);
  await expect(card.locator('.notifications-status')).toBeVisible();
  await page.getByRole('button', { name: 'Table', exact: true }).click();
  const row = page
    .locator('.notifications-table tbody tr')
    .filter({ hasText: 'Independent alteration sham-royal' });
  await expect(row).toContainText('$10.00');
  await expect(row).toContainText('Sham Royal');
  await page.getByRole('button', { name: 'Cards', exact: true }).click();
  await card
    .getByRole('link', {
      name: 'Independent alteration sham-royal',
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(
    new RegExp('/customers/' + reminderCustomerId + '$'),
  );
  await page.goto('/notifications');
  const reminder = page
    .locator('.notifications-card')
    .filter({ hasText: 'Independent alteration sham-royal' });
  await reminder.locator('.notification-record-link').click();
  await expect(page).toHaveURL(new RegExp('/alterations/' + reminderId + '$'));
  await expect(
    page
      .locator('.app-topbar')
      .getByRole('combobox', { name: 'Branch', exact: true }),
  ).toHaveValue('sham-royal');
  await page
    .getByRole('button', { name: 'Mark as delivered', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Confirm', exact: true })
    .click();
  await expect(page.locator('.alteration-details')).toContainText('Delivered');
  await reconcile();
  const after = (
    await (await request.get(base + '/notifications/global')).json()
  ).data as { alterationId?: string }[];
  expect(after.some((row) => row.alterationId === reminderId)).toBe(false);
  await page.goto('/alterations');
  const language = page.locator('select:has(option[value="en"])');
  for (const value of ['en', 'fa-AF', 'ps-AF']) {
    await language.selectOption(value);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  mkdirSync('.local/alteration-validation', { recursive: true });
  await page.screenshot({
    path: '.local/alteration-validation/mobile-ps.png',
    fullPage: true,
  });
});
