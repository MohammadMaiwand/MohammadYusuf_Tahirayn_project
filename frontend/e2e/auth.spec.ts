import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const password = 'Browser-Password-Secure-123';
async function logout(page: Page) {
  const profile = page.locator('.profile-dropdown');
  if (!(await profile.evaluate((node) => node.hasAttribute('open'))))
    await profile.locator('summary').click();
  await profile.getByRole('button', { name: 'Log out', exact: true }).click();
}
test('public Dari homepage stays separate from private data and links to protected login', async ({
  page,
}) => {
  const privateRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/branches/'))
      privateRequests.push(request.url());
  });
  await page.goto('/');
  await expect(page.locator('.public-site h1')).toContainText(
    'محمد یوسف طاهریان',
  );
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('#branches article')).toHaveCount(4);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
  }
  expect(privateRequests).toEqual([]);
  mkdirSync('.local/clothing-validation', { recursive: true });
  await page.screenshot({
    path: '.local/clothing-validation/home-desktop.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: '.local/clothing-validation/home-mobile.png',
    fullPage: true,
  });
  await page
    .locator('.public-header')
    .getByRole('link', { name: 'ورود به سیستم' })
    .click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('.login-card')).toBeVisible();
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
});
async function englishLogin(page: Page) {
  await page.goto('/dashboard');
  await page.locator('.login-card').waitFor();
  await page.locator('select:has(option[value="en"])').selectOption('en');
}
async function solve(page: Page) {
  await page
    .getByRole('button', { name: 'Accessible challenge', exact: true })
    .click();
  await expect(page.locator('.captcha-question')).toContainText('+');
  const values = (await page.locator('.captcha-question').innerText())
    .match(/\d+/g)!
    .map(Number);
  await page
    .getByRole('textbox', { name: 'Security verification', exact: true })
    .fill(String(values[0]! + values[1]!));
}
async function login(page: Page, role: string) {
  await englishLogin(page);
  await page
    .getByRole('combobox', { name: 'Role', exact: true })
    .selectOption(role);
  if (role === 'admin')
    await expect(
      page.getByRole('combobox', { name: 'Branch', exact: true }),
    ).toHaveCount(0);
  else
    await page
      .getByRole('combobox', { name: 'Branch', exact: true })
      .selectOption('sham-royal');
  await page
    .getByLabel('Employee name', { exact: true })
    .fill(`${role} Browser`);
  await page
    .getByLabel('Email address', { exact: true })
    .fill(`${role}@browser.local`);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await solve(page);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.locator('.app-topbar')).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard$/);
}
test('login supports all languages and a contained mobile layout', async ({
  page,
}) => {
  await englishLogin(page);
  for (const language of ['fa-AF', 'ps-AF', 'en']) {
    await page.locator('select:has(option[value="en"])').selectOption(language);
    await expect(page.locator('html')).toHaveAttribute(
      'dir',
      language === 'en' ? 'ltr' : 'rtl',
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('select:has(option[value="en"])').selectOption('fa-AF');
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  mkdirSync('.local/auth-validation', { recursive: true });
  await page.screenshot({
    path: '.local/auth-validation/login-fa.png',
    fullPage: true,
  });
});

test('a signed offline session survives reload and locks after its bounded expiry', async ({
  page,
  context,
}) => {
  await page.clock.install({ time: new Date() });
  await login(page, 'employee');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await expect(page.locator('.app-topbar')).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Your daily workspace', exact: true }),
  ).toBeVisible();
  await page.clock.fastForward('08:01:00');
  await expect(page.locator('.login-card')).toBeVisible();
  await context.setOffline(false);
});
for (const role of ['admin', 'manager', 'employee'])
  test(`${role} logs in to the correct dashboard and branch scope, then logs out`, async ({
    page,
  }) => {
    await login(page, role);
    await expect(
      page.getByRole('heading', {
        name:
          role === 'admin'
            ? 'Company overview'
            : role === 'manager'
              ? 'Branch management'
              : 'Your daily workspace',
        exact: true,
      }),
    ).toBeVisible();
    const selector = page
      .locator('.app-topbar')
      .getByRole('combobox', { name: 'Branch', exact: true });
    await expect(selector.locator('option')).toHaveCount(
      role === 'admin' ? 4 : 1,
    );
    if (role === 'employee') {
      await expect(
        page
          .locator('.app-sidebar')
          .getByRole('link', { name: 'Staff permissions', exact: true }),
      ).toHaveCount(0);
      await page.setViewportSize({ width: 390, height: 844 });
      await expect
        .poll(() =>
          page
            .locator('.app-sidebar')
            .evaluate((element) => element.getBoundingClientRect().right),
        )
        .toBeLessThanOrEqual(0);
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
      await page.screenshot({
        path: '.local/auth-validation/employee-mobile.png',
        fullPage: true,
      });
    }
    await logout(page);
    await expect(page.locator('.login-card')).toBeVisible();
    await page.reload();
    await expect(page.locator('.login-card')).toBeVisible();
  });

test('manager creates a branch employee and revokes their access through account status', async ({
  page,
}) => {
  await login(page, 'manager');
  await page.goto('/users');
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  const form = page.getByRole('dialog');
  await expect(
    form.getByRole('combobox', { name: 'Role', exact: true }).locator('option'),
  ).toHaveCount(1);
  await expect(
    form
      .getByRole('combobox', { name: 'Branch', exact: true })
      .locator('option'),
  ).toHaveCount(1);
  await form
    .getByLabel('Employee name', { exact: true })
    .fill('Created Browser Employee');
  await form
    .getByLabel('Email address', { exact: true })
    .fill('created@browser.local');
  await form.getByLabel('Password', { exact: true }).fill(password);
  await form.getByLabel('Confirm password', { exact: true }).fill(password);
  page.once('dialog', (dialog) => dialog.accept());
  await form.getByRole('button', { name: 'Save', exact: true }).click();
  const row = page
    .getByRole('row')
    .filter({ hasText: 'created@browser.local' });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Edit', exact: true }).click();
  await form
    .getByRole('combobox', { name: 'Account status', exact: true })
    .selectOption('suspended');
  page.once('dialog', (dialog) => dialog.accept());
  await form.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(row).toContainText('Suspended');
  await logout(page);
  await englishLogin(page);
  await page
    .getByLabel('Employee name', { exact: true })
    .fill('Created Browser Employee');
  await page
    .getByLabel('Email address', { exact: true })
    .fill('created@browser.local');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await solve(page);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.locator('.login-card')).toBeVisible();
  await expect(page.locator('.login-card [role="alert"]')).toBeVisible();
});
test('admin and manager account forms enforce scopes and save a real employee', async ({
  page,
}) => {
  await login(page, 'manager');
  await page.goto('/users');
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog
      .getByRole('combobox', { name: 'Role', exact: true })
      .locator('option'),
  ).toHaveCount(1);
  await expect(
    dialog
      .getByRole('combobox', { name: 'Branch', exact: true })
      .locator('option'),
  ).toHaveCount(1);
  await dialog
    .getByLabel('Employee name', { exact: true })
    .fill('Managed Browser Employee');
  await dialog
    .getByLabel('Email address', { exact: true })
    .fill('managed@browser.local');
  await dialog.getByLabel('Password', { exact: true }).fill(password);
  await dialog.getByLabel('Confirm password', { exact: true }).fill(password);
  await expect(dialog.getByRole('checkbox')).not.toHaveCount(0);
  page.once('dialog', (message) => message.accept());
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole('cell', { name: 'Managed Browser Employee', exact: true }),
  ).toBeVisible();
  await logout(page);
  await login(page, 'admin');
  await page.goto('/users');
  await expect(
    page.getByRole('cell', { name: 'Managed Browser Employee', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await expect(
    page
      .getByRole('dialog')
      .getByRole('combobox', { name: 'Role', exact: true })
      .locator('option'),
  ).toHaveCount(3);
});

test('manager can open the branch-scoped advertisement tools', async ({
  page,
}) => {
  await login(page, 'manager');
  await page.goto('/advertisements');
  await expect(
    page
      .locator('.app-sidebar')
      .getByRole('link', { name: 'Advertisements', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Advertisements', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'New advertisement' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Title', { exact: true })).toBeVisible();
  await expect(
    dialog.getByLabel('Message text', { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Upload image', exact: true }),
  ).toBeVisible();
  await expect(dialog.getByLabel('Enabled', { exact: true })).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Start date', exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'End date', exact: true }),
  ).toBeVisible();
});
test('manager messages persist and are readable by branch employees', async ({
  page,
}) => {
  await login(page, 'manager');
  await page.goto('/notifications');
  await page
    .getByLabel('Message title', { exact: true })
    .fill('Branch browser notice');
  await page
    .getByLabel('Message', { exact: true })
    .fill('Please check tomorrow delivery schedule.');
  const panel = page
    .locator('section')
    .filter({ has: page.getByLabel('Message title', { exact: true }) });
  await panel.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Branch browser notice', exact: true }),
  ).toBeVisible();
  await logout(page);
  await login(page, 'employee');
  await page.goto('/notifications');
  await expect(
    page.getByRole('heading', { name: 'Branch browser notice', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Message title', { exact: true })).toHaveCount(
    0,
  );
});
test('company report remains admin-only when opened directly', async ({
  page,
}) => {
  await login(page, 'manager');
  const companyReportRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/v1/reports/company')
      companyReportRequests.push(request.url());
  });
  await page.goto('/reports/company');
  await expect(page.locator('.app-content')).toContainText(
    'You do not have permission for this action.',
  );
  expect(companyReportRequests).toEqual([]);
});
test('authorized invoice sharing builds a reviewed WhatsApp link without sending', async ({
  page,
}) => {
  await login(page, 'admin');
  const device = await page.evaluate(() =>
    localStorage.getItem('myt-device-id'),
  );
  const command = async (
    action: string,
    data: unknown,
    extra: Record<string, unknown> = {},
  ) => {
    const response = await page.request.post(
      'http://127.0.0.1:4000/api/v1/branches/sham-royal/commands',
      {
        headers: { 'x-myt-request': '1' },
        data: {
          action,
          data,
          operationId: crypto.randomUUID(),
          deviceId: device,
          ...extra,
        },
      },
    );
    expect(response.status(), await response.text()).toBe(200);
    return (await response.json()).data;
  };
  await command('device.register', { label: 'Share test device' });
  const product = await command(
    'catalog.create',
    { name: 'Share product', clothingId: 'SHARE-001', price: '100' },
    { resource: 'products' },
  );
  const customer = await command('customer.create', {
    fullName: 'Share customer',
    telephone: '0701234567',
    whatsapp: '0701234567',
  });
  const txn = await command('transaction.create', {
    customerId: customer._id,
    productId: product._id,
    type: 'purchase',
    agreedPrice: '100',
    advance: '10',
    reservationAt: new Date().toISOString(),
  });
  const invoice = await command('invoice.issue', { transactionId: txn._id });
  await page.goto('/transactions');
  await page
    .getByRole('combobox', { name: 'Transaction type', exact: true })
    .selectOption('purchase');
  const saleRow = page.getByRole('row').filter({ hasText: 'Share customer' });
  await saleRow
    .getByRole('button', { name: 'Print bill', exact: true })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/print/${invoice._id}\\?autoprint=1$`),
  );
  await page.goto(`/print/${invoice._id}`);
  const link = page.getByRole('link', {
    name: 'Share via WhatsApp',
    exact: true,
  });
  await expect(link).toBeVisible();
  const href = await link.getAttribute('href');
  expect(href).toContain('https://wa.me/93701234567?text=');
  const message = new URL(href!).searchParams.get('text');
  expect(message).toContain(invoice.code);
  expect(message).toContain('Share customer');
  expect(message).toContain('90.00');
  await expect(
    page.getByRole('button', { name: 'Print / Save PDF', exact: true }),
  ).toBeEnabled();
});

test('business list print previews preserve visible branch rows and hide controls on paper', async ({
  page,
}) => {
  await login(page, 'admin');
  await page.goto('/transactions');
  await page
    .getByRole('combobox', { name: 'Transaction type', exact: true })
    .selectOption('purchase');
  await expect(
    page.getByRole('row').filter({ hasText: 'Share customer' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Print list', exact: true }).click();
  const preview = page.locator('.list-print-document');
  await expect(preview).toContainText('Share customer');
  await expect(preview).toContainText('Sham Royal');
  await expect(preview.locator('tbody tr')).toHaveCount(1);
  await expect(
    preview.locator('button, .pagination, .print-exclude'),
  ).toHaveCount(0);
  await page.evaluate(() => {
    window.print = () => {
      document.body.dataset.printInvoked = 'true';
    };
  });
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Print / Save PDF', exact: true })
    .click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-print-invoked',
    'true',
  );
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#root')).toHaveCSS('display', 'none');
  await expect(preview).toBeVisible();
  await expect(preview.locator('.table-scroll').first()).toHaveCSS(
    'overflow',
    'visible',
  );
  mkdirSync('.local/list-print-validation', { recursive: true });
  await page.pdf({
    path: '.local/list-print-validation/sales-a4.pdf',
    preferCSSPageSize: true,
  });
  await page.screenshot({
    path: '.local/list-print-validation/sales-print.png',
    fullPage: true,
  });
  await page.emulateMedia({ media: 'screen' });
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Close', exact: true })
    .click();
  await page
    .locator('.app-topbar')
    .getByRole('combobox', { name: 'Branch', exact: true })
    .selectOption('sham-aroos');
  await expect(
    page.getByRole('button', { name: 'Print list', exact: true }),
  ).toBeDisabled();
  await expect(page.getByText('Share customer', { exact: true })).toHaveCount(
    0,
  );
  await page.goto('/customers');
  await expect(
    page.getByRole('button', { name: 'Print list', exact: true }),
  ).toBeVisible();
  await page.goto('/products');
  await expect(
    page.getByRole('button', { name: 'Print list', exact: true }),
  ).toBeVisible();
  await page.goto('/expenses');
  await expect(
    page.getByRole('button', { name: 'Print list', exact: true }),
  ).toBeVisible();
});

test('premium system screens preserve navigation, real charts, RTL and reduced motion', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const globalRequests: string[] = [];
  page.on('request', (request) => {
    if (
      request.url().includes('/dashboard/comparison') ||
      request.url().includes('/notifications/global')
    )
      globalRequests.push(request.url());
  });
  await login(page, 'manager');
  await expect(page.locator('.premium-stats .stat')).toHaveCount(9);
  await expect(
    page.locator('.dashboard-chart .recharts-area-dot').first(),
  ).toBeVisible();
  await expect(page.locator('.dashboard-donut .recharts-pie')).toBeVisible();
  await expect(page.locator('.premium-stats .stat').first()).toHaveCSS(
    'animation-name',
    'none',
  );
  const result = await page.request.get(
    'http://127.0.0.1:4000/api/v1/branches/sham-royal/dashboard',
  );
  expect(result.ok()).toBe(true);
  const report = (await result.json()).data;
  await expect(page.locator('.count-value').first()).toHaveAttribute(
    'aria-label',
    String(report.customers),
  );
  await page
    .getByRole('button', { name: 'Collapse sidebar', exact: true })
    .click();
  await expect(page.locator('.app-frame')).toHaveClass(/sidebar-collapsed/);
  await page.reload();
  await expect(page.locator('.app-frame')).toHaveClass(/sidebar-collapsed/);
  await page
    .getByRole('button', { name: 'Expand sidebar', exact: true })
    .click();
  await page.locator('.profile-dropdown summary').click();
  await expect(
    page
      .locator('.profile-menu')
      .getByRole('link', { name: 'Sessions & password', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.profile-dropdown')).not.toHaveAttribute(
    'open',
    '',
  );
  for (const path of [
    '/products',
    '/product-categories',
    '/guarantees',
    '/package-items',
    '/expenses',
    '/customers',
    '/transactions',
    '/reports',
    '/notifications',
    '/settings',
    '/users',
    '/sessions',
    '/audit-logs',
    '/sync',
  ]) {
    await page.goto(path);
    await expect(page.locator('.app-content h1').first()).toBeVisible();
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
    }
  }
  await page.goto('/dashboard');
  await expect(page.locator('.premium-stats .stat')).toHaveCount(9);
  mkdirSync('.local/premium-validation', { recursive: true });
  await page.screenshot({
    path: '.local/premium-validation/manager-en-desktop.png',
    fullPage: true,
  });
  for (const language of ['fa-AF', 'ps-AF', 'en']) {
    await page
      .locator('.app-topbar select:has(option[value="en"])')
      .selectOption(language);
    await expect(page.locator('html')).toHaveAttribute(
      'dir',
      language === 'en' ? 'ltr' : 'rtl',
    );
    for (const width of [320, 390, 768, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
    }
    if (language === 'fa-AF') {
      await page.screenshot({
        path: '.local/premium-validation/manager-fa-desktop.png',
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({
        path: '.local/premium-validation/manager-fa-mobile.png',
        fullPage: true,
      });
      await page.locator('.menu-toggle').click();
      await expect(page.locator('.app-sidebar')).toHaveClass(/open/);
      await page.keyboard.press('Escape');
      await expect(page.locator('.app-sidebar')).not.toHaveClass(/open/);
      await expect(page.locator('.app-sidebar')).toHaveAttribute('inert', '');
    }
  }
  expect(globalRequests).toEqual([]);
  await page.goto('/users');
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: '.local/premium-validation/account-form-mobile.png',
    fullPage: true,
  });
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Cancel', exact: true })
    .click();
});

test('premium dashboard distinguishes loading and failed data from zero totals', async ({
  page,
}) => {
  await login(page, 'manager');
  let release: () => void = () => {};
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    (url) => url.pathname === '/api/v1/branches/sham-royal/dashboard',
    async (route) => {
      await hold;
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'request_failed' } }),
      });
    },
  );
  await page.reload();
  await expect(page.locator('.skeleton').first()).toBeVisible();
  release();
  await expect(page.locator('.app-content .empty.error').first()).toBeVisible();
  await expect(page.locator('.premium-stats')).toHaveCount(0);
  await expect(
    page
      .locator('.app-content')
      .getByRole('button', { name: 'Retry', exact: true }),
  ).toBeVisible();
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.print = () => {
      document.body.dataset.printInvoked = 'true';
    };
  });
});

test('enterprise preferences persist and horizontal menus support keyboard, finder and permissions', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 850 });
  await login(page, 'employee');
  await page.getByRole('button', { name: 'Color theme', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page
    .getByRole('button', { name: 'Navigation layout', exact: true })
    .click();
  await expect(page.locator('.app-frame')).toHaveClass(/navigation-top/);
  await expect(page.locator('.app-sidebar')).toBeHidden();
  const menu = page.locator('.top-menubar');
  const daily = menu.locator('summary').filter({ hasText: 'Daily operations' });
  await daily.focus();
  await page.keyboard.press('ArrowDown');
  await expect(
    menu.getByRole('link', { name: 'Overview', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(
    menu.getByRole('link', { name: 'Customers', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/customers$/);
  const sorted = page.waitForResponse(
    (response) =>
      response.url().includes('/customers?') &&
      response.url().includes('sort=fullName'),
  );
  await page.locator('.list-order select').first().selectOption('fullName');
  expect((await sorted).ok()).toBe(true);
  await page
    .getByRole('button', { name: 'Clear filters', exact: true })
    .click();

  await expect(page.locator('.list-order select').first()).toHaveValue(
    'createdAt',
  );
  await page.locator('.list-order select').first().selectOption('fullName');

  await expect(menu.locator('details[open]')).toHaveCount(0);
  await daily.click();
  await page.locator('.breadcrumb').click();
  await expect(menu.locator('details[open]')).toHaveCount(0);
  await page.keyboard.press('Control+k');
  const finder = page.getByRole('dialog', { name: 'Find a page', exact: true });
  await finder.getByRole('textbox').fill('Staff');
  await expect(finder.getByRole('link')).toHaveCount(0);
  await finder.getByRole('textbox').fill('Customers');
  await finder.getByRole('link', { name: 'Customers', exact: true }).click();
  await expect(finder).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.list-order select').first()).toHaveValue(
    'fullName',
  );
  await expect(page.locator('.app-frame')).toHaveClass(/navigation-top/);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await logout(page);
  await expect(page.locator('.login-card')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await login(page, 'employee');
  await expect(page.locator('.app-frame')).toHaveClass(/navigation-top/);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(
    page
      .locator('.app-topbar')
      .getByRole('combobox', { name: 'Branch', exact: true })
      .locator('option'),
  ).toHaveCount(1);
});

test('enterprise dark RTL routes and large forms keep one scroll region and visible heading', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1366, height: 768 });
  await login(page, 'manager');
  await page.getByRole('button', { name: 'Color theme', exact: true }).click();
  await page
    .getByRole('button', { name: 'Navigation layout', exact: true })
    .click();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  for (const path of [
    '/dashboard',
    '/customers',
    '/transactions',
    '/products',
    '/product-categories',
    '/guarantees',
    '/package-items',
    '/expenses',
    '/reports',
    '/notifications',
    '/settings',
    '/users',
    '/sessions',
    '/audit-logs',
    '/sync',
  ]) {
    await page.goto(path);
    await expect(page.locator('.app-content h1').first()).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
  }

  mkdirSync('.local/enterprise-validation', { recursive: true });
  await page.goto('/dashboard');
  await page.screenshot({
    path: '.local/enterprise-validation/dashboard-dark-en-top.png',
    fullPage: true,
  });
  for (const language of ['en', 'fa-AF', 'ps-AF']) {
    await page
      .locator('.app-topbar select:has(option[value="en"])')
      .selectOption(language);
    for (const width of [320, 390, 768, 1366]) {
      await page.setViewportSize({ width, height: 768 });
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
    }
  }
  await page
    .locator('.app-topbar select:has(option[value="en"])')
    .selectOption('en');
  await page.goto('/customers');
  await page
    .locator('.app-topbar')
    .getByRole('combobox', { name: 'Language', exact: true })
    .selectOption('fa-AF');
  await page.goto('/customers?new=1');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveClass(/modal-large/);
  await expect(page.locator('#root')).toHaveAttribute('inert', '');
  expect(
    await dialog.evaluate(
      (node) => node.parentElement?.parentElement === document.body,
    ),
  ).toBe(true);
  const checkGeometry = async () => {
    const geometry = await dialog.evaluate((node) => {
      const heading = node
        .querySelector('.modal-heading')!
        .getBoundingClientRect();
      return {
        top: heading.top,
        bottom: heading.bottom,
        height: innerHeight,
        bodyLocked: getComputedStyle(document.body).overflow === 'hidden',
        backdropScrollable: ['auto', 'scroll'].includes(
          getComputedStyle(node.parentElement!).overflowY,
        ),
      };
    });
    expect(geometry.top).toBeGreaterThanOrEqual(0);
    expect(geometry.bottom).toBeLessThan(geometry.height);
    expect(geometry.bodyLocked).toBe(true);
    expect(geometry.backdropScrollable).toBe(false);
  };
  await checkGeometry();
  mkdirSync('.local/enterprise-validation', { recursive: true });
  await page.screenshot({
    path: '.local/enterprise-validation/form-dark-fa-desktop.png',
    fullPage: true,
  });
  await dialog.locator('.modal-body').evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await checkGeometry();
  await page.screenshot({
    path: '.local/enterprise-validation/form-dark-fa-bottom.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await checkGeometry();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: '.local/enterprise-validation/form-dark-fa-mobile.png',
    fullPage: true,
  });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('#root')).not.toHaveAttribute('inert', '');
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  // Both persisted desktop modes use the same accessible mobile drawer.
  await page.locator('.menu-toggle').click();
  await expect(page.locator('.app-sidebar')).toHaveClass(/open/);
  await page.keyboard.press('Escape');
  await expect(page.locator('.app-sidebar')).toHaveAttribute('inert', '');
  expect(errors).toEqual([]);
});

test('reports preserve authenticated CSV and Excel downloads with the shared controls', async ({
  page,
}) => {
  await login(page, 'manager');
  await page.goto('/reports');
  for (const [label, filename] of [
    ['Export CSV', 'transactions.csv'],
    ['Export for Excel', 'transactions.xml'],
  ]) {
    const downloaded = page.waitForEvent('download');
    const response = page.waitForResponse((r) =>
      r.url().includes('/reports/export?'),
    );
    await page.getByRole('button', { name: label, exact: true }).click();
    expect((await response).status()).toBe(200);
    const download = await downloaded;
    expect(download.suggestedFilename()).toBe(filename);
    expect(await download.failure()).toBeNull();
  }
});

test('entry galleries, themes and login controls remain usable at desktop and mobile sizes', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const path of ['/', '/login']) {
    await page.goto(path);
    const gallery = page.locator('.bridal-gallery');
    await expect(gallery).toBeVisible();
    await expect
      .poll(() =>
        gallery
          .locator('img')
          .first()
          .evaluate((img) => (img as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
    await gallery.locator('.bridal-dot').nth(1).click();
    await expect(gallery.locator('.bridal-dot').nth(1)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(gallery.locator('.bridal-slide.is-active img')).toBeVisible();
    for (const theme of ['dark', 'light']) {
      await page.evaluate((value) => {
        const current = document.documentElement.dataset.theme;
        if (current !== value)
          (
            document.querySelector(
              '.appearance-controls button',
            ) as HTMLButtonElement
          ).click();
      }, theme);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      for (const width of [320, 390, 768, 1366]) {
        await page.setViewportSize({ width, height: 900 });
        await expect
          .poll(() =>
            page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          )
          .toBe(true);
      }
      await page.screenshot({
        path: `.local/auth-validation/${path === '/' ? 'public' : 'login'}-${theme}.png`,
        fullPage: true,
      });
    }
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  }
  await englishLogin(page);
  await page
    .getByLabel('Password', { exact: true })
    .fill('Not-a-real-account-secret');
  await page
    .getByRole('button', { name: 'Show password', exact: true })
    .click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute(
    'type',
    'text',
  );
  await page
    .getByRole('button', { name: 'Hide password', exact: true })
    .click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute(
    'type',
    'password',
  );
});

test('bridal gallery rotates, pauses and keeps an intentional image failure state', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.clock.install();
  await page.goto('/');
  await expect(page.locator('.bridal-dot').first()).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.clock.runFor(7000);
  await expect(page.locator('.bridal-dot').nth(1)).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.locator('.bridal-controls > button').first().click();
  await page.mouse.move(0, 0);
  await page.clock.runFor(14000);
  await expect(page.locator('.bridal-dot').nth(1)).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.route('**/images/bridal/*.jpg', (route) => route.abort());
  await page.reload();
  await expect(page.locator('.bridal-gallery img')).toHaveCount(0);
  await expect(page.locator('.bridal-fallback')).toBeVisible();
  await expect(page.locator('.bridal-caption h2')).toBeVisible();
});

test('login shows complete photos and gold public actions retain hover contrast', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/login');
  await page.locator('select:has(option[value="en"])').selectOption('fa-AF');
  for (const theme of ['light', 'dark']) {
    await expect(page.locator('.login-card')).toBeVisible();
    if ((await page.locator('html').getAttribute('data-theme')) !== theme)
      await page.locator('.login-card .appearance-controls button').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    for (const width of [390, 1366]) {
      await page.setViewportSize({ width, height: 640 });
      for (let index = 0; index < 3; index++) {
        await page.locator('.bridal-dot').nth(index).click();
        const image = page.locator('.bridal-slide.is-active img');
        await expect(image).toHaveCSS('object-fit', 'contain');
        await expect
          .poll(() =>
            image.evaluate(
              (element) => (element as HTMLImageElement).naturalWidth,
            ),
          )
          .toBeGreaterThan(0);
        const photo = await image.boundingBox();
        const caption = await page.locator('.bridal-caption').boundingBox();
        expect((photo?.y || 0) + (photo?.height || 0)).toBeLessThanOrEqual(
          caption?.y || 0,
        );
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      if (width === 1366) {
        const submit = await page
          .locator('.login-card button[type="submit"]')
          .boundingBox();
        expect((submit?.y || 0) + (submit?.height || 0)).toBeLessThanOrEqual(
          640,
        );
      }
      await page.screenshot({
        path: `.local/auth-validation/login-complete-${theme}-${width}.png`,
        fullPage: true,
      });
    }
    await page.goto('/');
    const button = page.locator('.public-header .public-login');
    await button.hover();
    await expect(button).toHaveCSS('color', 'rgb(21, 59, 46)');
    await expect(button).toHaveCSS('background-image', /linear-gradient/);
    await page.screenshot({
      path: `.local/auth-validation/public-hover-${theme}.png`,
      fullPage: false,
    });
    await page.goto('/login');
  }
});
