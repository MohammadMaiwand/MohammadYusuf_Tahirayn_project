export const permissions = [
  'dashboard.read',
  'catalog.read',
  'catalog.write',
  'products.create',
  'products.update',
  'product-categories.create',
  'product-categories.update',
  'guarantees.create',
  'guarantees.update',
  'package-items.create',
  'package-items.update',
  'customers.read',
  'customers.write',
  'alterations.read',
  'alterations.read.all',
  'alterations.create',
  'alterations.update',
  'alterations.status',
  'alterations.financial',
  'alterations.print',
  'expenses.read',
  'expenses.create',
  'transactions.read.own',
  'transactions.read.all',
  'transactions.update',
  'transactions.create',
  'transactions.backdate',
  'delivery.write',
  'delivery.unpaid',
  'payments.create',
  'payments.reverse',
  'payments.overpay',
  'invoices.read',
  'invoices.issue',
  'guarantees.sensitive',
  'reports.read',
  'exports.read',
  'notifications.read',
  'messages.read',
  'messages.write',
  'advertisements.manage',
  'settings.write',
  'users.manage',
  'users.create',
  'users.update',
  'users.password',
  'permissions.assign',
  'sessions.manage',
  'security.read',
  'global.read',
  'audit.read',
  'sync.use',
  'offline.write',
] as const;
export type Permission = (typeof permissions)[number];
export type Role = 'admin' | 'manager' | 'employee';
export const rolePermissions: Record<Role, readonly Permission[]> = {
  admin: permissions,
  manager: permissions.filter(
    (p) =>
      ![
        'sessions.manage',
        'security.read',
        'global.read',
        'payments.overpay',
        'transactions.backdate',
      ].includes(p),
  ),
  employee: [
    'dashboard.read',
    'catalog.read',
    'customers.read',
    'customers.write',
    'alterations.read',
    'alterations.create',
    'alterations.update',
    'alterations.status',
    'alterations.financial',
    'alterations.print',
    'expenses.read',
    'expenses.create',
    'transactions.read.own',
    'transactions.create',
    'payments.create',
    'invoices.read',
    'invoices.issue',
    'notifications.read',
    'messages.read',
    'sync.use',
    'offline.write',
  ],
};
export interface SessionIdentity {
  subject: string;
  name: string;
  role: Role;
  branchIds: string[];
  permissions: Permission[];
  development: boolean;
  language: 'en' | 'fa-AF' | 'ps-AF';
  expiresAt: string;
  offlineProof?: string;
  deviceId?: string;
}

export function effectivePermissions(
  role: Role,
  allow: readonly Permission[],
  deny: readonly Permission[],
): Permission[] {
  const granted = new Set<Permission>([...rolePermissions[role], ...allow]);
  const catalog = [
    'products',
    'product-categories',
    'guarantees',
    'package-items',
  ] as const;
  if (granted.has('catalog.write'))
    for (const resource of catalog) {
      granted.add(`${resource}.create`);
      granted.add(`${resource}.update`);
    }
  return [...granted].filter(
    (p) =>
      !deny.includes(p) &&
      !(
        deny.includes('catalog.write') &&
        catalog.some(
          (resource) =>
            p === `${resource}.create` || p === `${resource}.update`,
        )
      ),
  );
}
