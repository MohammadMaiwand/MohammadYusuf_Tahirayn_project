import {
  alterationQuery,
  alterationList,
  alterationDetail,
} from '../modules/alterations/service.js';
import { notificationAudience } from '../security/notificationAudience.js';
import { Router, type Request } from 'express';
import { z } from 'zod';
import {
  uuid,
  branches,
  commandSchema,
  permissions,
  rolePermissions,
  calendarDay,
} from '@myt/shared';
import type { Environment } from '../config/env.js';
import {
  resolveIdentity,
  context,
  requirePermission,
  type Actor,
} from '../security/identity.js';
import { executeCommand } from '../services/commands.js';
import {
  resourceList,
  customerDetail,
  transactionDetail,
  invoiceDetail,
  present,
  enrichNotifications,
  settingsRead,
  usersRead,
} from '../services/queries.js';
import { listQuery } from '../validators/query.js';
import {
  report,
  exportReport,
  companyReport,
  exportCompanyReport,
} from '../modules/reports/service.js';
import { pull } from '../modules/sync/service.js';
import { HttpError } from '../utils/errors.js';
import { listExpenses } from '../modules/expenses/service.js';
import { BranchMessage } from '../modules/auth/models.js';
import { event } from '../modules/auth/core.js';
import { randomUUID } from 'node:crypto';
import { Branch, catalogModels } from '../database/models.js';
import { photoRoutes } from '../modules/catalog/photos.js';
import { advertisementRoutes } from '../modules/advertisements/routes.js';
import { occupancyFilter } from '../modules/catalog/availability.js';
export type IdentityResolver = (request: Request) => Promise<Actor>;
export function businessRouter(
  env: Environment,
  testIdentity?: IdentityResolver,
) {
  if (testIdentity && env.NODE_ENV !== 'test')
    throw new Error('Test identity resolver is test-only');
  const router = Router();
  router.use(async (req, res, next) => {
    try {
      res.locals.actor = await (testIdentity
        ? testIdentity(req)
        : resolveIdentity(req, env));
      next();
    } catch (error) {
      next(error);
    }
  });
  router.get('/session', (req, res) => res.json({ data: res.locals.actor }));
  router.get('/branches', async (_req, res) => {
    const actor = res.locals.actor as Actor;
    res.json({
      data: await Branch.find({
        _id: { $in: actor.branchIds },
        active: true,
      }).lean(),
    });
  });
  router.get('/permissions', (_req, res) => {
    requirePermission(res.locals.actor as Actor, 'users.manage');
    res.json({ data: { permissions, roles: rolePermissions } });
  });
  router.get('/notifications/global', async (req, res) => {
    const actor = res.locals.actor as Actor;
    if (actor.role !== 'admin') throw new HttpError(403, 'forbidden');
    requirePermission(actor, 'notifications.read');
    const { Notification } = await import('../database/models.js');
    const notifications = await Notification.find({
      branchId: { $in: actor.branchIds },
      resolved: false,
      ...notificationAudience(actor),
      ...(req.query.unread === 'true'
        ? { readBy: { $ne: actor.subject } }
        : {}),
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({
      data: await enrichNotifications(notifications, actor),
    });
  });
  router.post('/notifications/:id/read', async (req, res) => {
    const actor = res.locals.actor as Actor;
    if (actor.role !== 'admin') throw new HttpError(403, 'forbidden');
    requirePermission(actor, 'notifications.read');
    const { Notification } = await import('../database/models.js');
    const data = z.object({ read: z.boolean() }).strict().parse(req.body);
    const record = await Notification.findOneAndUpdate(
      {
        _id: uuid.parse(req.params.id),
        branchId: { $in: actor.branchIds },
        ...notificationAudience(actor),
      },
      data.read
        ? { $addToSet: { readBy: actor.subject } }
        : { $pull: { readBy: actor.subject } },
      { new: true },
    );
    if (!record) throw new HttpError(404, 'not_found');
    res.json({ data: record });
  });
  router.get('/dashboard/comparison', async (req, res) => {
    const actor = res.locals.actor as Actor;
    if (actor.role !== 'admin') throw new HttpError(403, 'forbidden');
    requirePermission(actor, 'reports.read');
    const query = listQuery.parse(req.query);
    const results = [];
    for (const id of actor.branchIds) {
      if (branches.some((b) => b.active && b.id === id))
        results.push({
          branchId: id,
          ...(await report(context(actor, id), query)),
        });
    }
    res.json({ data: results });
  });
  router.get('/reports/company', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      data: await companyReport(
        res.locals.actor as Actor,
        listQuery.parse(req.query),
      ),
    });
  });
  router.get('/reports/company/export', async (req, res) => {
    const format = z.enum(['csv', 'excel']).parse(req.query.format);
    const output = await exportCompanyReport(
      res.locals.actor as Actor,
      listQuery.parse(req.query),
      format,
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="company-report.${format === 'csv' ? 'csv' : 'xml'}"`,
    );
    res
      .type(format === 'csv' ? 'text/csv' : 'application/vnd.ms-excel')
      .send(output);
  });
  advertisementRoutes(router);
  const scoped = Router({ mergeParams: true });
  scoped.use((req, res, next) => {
    try {
      res.locals.context = context(
        res.locals.actor as Actor,
        String(req.params.branchId),
      );
      next();
    } catch (error) {
      next(error);
    }
  });
  photoRoutes(scoped);
  scoped.get('/alterations', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      data: await alterationList(
        res.locals.context,
        alterationQuery.parse(req.query),
      ),
    });
  });
  scoped.get('/alterations/tailors', async (_req, res) => {
    const ctx = res.locals.context as import('../security/identity.js').Context;
    requirePermission(ctx.actor, 'alterations.read');
    const { User } = await import('../database/models.js');
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      data: await User.find({
        branchIds: ctx.branchId,
        disabled: false,
        accountStatus: 'active',
      })
        .select('_id name')
        .sort({ name: 1 })
        .limit(200)
        .lean(),
    });
  });
  scoped.get('/alterations/:id', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      data: await alterationDetail(
        res.locals.context,
        uuid.parse(req.params.id),
      ),
    });
  });
  scoped.get('/alterations/:id/receipt', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      data: await alterationDetail(
        res.locals.context,
        uuid.parse(req.params.id),
        true,
      ),
    });
  });
  scoped.get('/products/:id/availability', async (req, res) => {
    const ctx = res.locals.context;
    requirePermission(ctx.actor, 'catalog.read');
    const query = z
      .object({
        reservationAt: z.iso.datetime({ offset: true }),
        returnDueAt: z.iso.datetime({ offset: true }).optional(),
        type: z.enum(['rental', 'purchase']),
      })
      .strict()
      .parse(req.query);
    const item = await catalogModels.products.exists({
      _id: uuid.parse(req.params.id),
      branchId: ctx.branchId,
      status: 'active',
    });
    if (!item) throw new HttpError(404, 'not_found');
    const { Transaction } = await import('../database/models.js');
    const start =
      query.type === 'purchase' ? new Date() : new Date(query.reservationAt);
    const end = query.returnDueAt ? new Date(query.returnDueAt) : null;
    if (end && calendarDay(end) < calendarDay(start))
      throw new HttpError(422, 'invalid_return_date');
    res.set('Cache-Control', 'private, no-store').json({
      data: {
        available: !(await Transaction.exists(
          occupancyFilter(
            ctx.branchId,
            String(req.params.id),
            start,
            end,
            query.type === 'purchase',
          ),
        )),
      },
    });
  });
  scoped.post('/commands', async (req, res) => {
    res.status(200).json({
      data: present(
        await executeCommand(res.locals.context, req.body),
        res.locals.context,
      ),
    });
  });
  scoped.post('/sync/push', async (req, res) => {
    if (env.OFFLINE_SYNC_ENABLED !== 'true')
      throw new HttpError(403, 'sync_disabled');
    requirePermission(res.locals.context.actor, 'sync.use');
    const body = z
      .object({ operations: z.array(commandSchema).min(1).max(25) })
      .strict()
      .parse(req.body);
    const results = [];
    for (const operation of body.operations) {
      try {
        results.push({
          operationId: operation.operationId,
          status: 'synced',
          result: present(
            await executeCommand(res.locals.context, operation, true),
            res.locals.context,
          ),
        });
      } catch (error) {
        if (!(error instanceof HttpError) && !(error instanceof z.ZodError))
          throw error;
        results.push({
          operationId: operation.operationId,
          status:
            error instanceof HttpError && error.status === 409
              ? 'conflict'
              : 'failed',
          code:
            error instanceof HttpError ? error.message : 'validation_failed',
        });
      }
    }
    res.json({ data: results });
  });
  scoped.get('/sync/pull', async (req, res) => {
    if (env.OFFLINE_SYNC_ENABLED !== 'true')
      throw new HttpError(403, 'sync_disabled');
    res.json({ data: await pull(res.locals.context, req.query) });
  });
  scoped.get('/messages', async (req, res) => {
    const ctx = res.locals.context;
    requirePermission(ctx.actor, 'messages.read');
    const query = listQuery.parse(req.query);
    const filter = { branchId: ctx.branchId };
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      data: {
        items: await BranchMessage.find(filter)
          .sort({ createdAt: -1 })
          .skip((query.page - 1) * query.limit)
          .limit(query.limit)
          .lean(),
        total: await BranchMessage.countDocuments(filter),
        page: query.page,
        limit: query.limit,
      },
    });
  });
  scoped.post('/messages', async (req, res) => {
    const ctx = res.locals.context;
    requirePermission(ctx.actor, 'messages.write');
    const data = z
      .object({
        title: z.string().trim().min(1).max(160),
        body: z.string().trim().min(1).max(2000),
      })
      .strict()
      .parse(req.body);
    const record = await BranchMessage.create({
      _id: randomUUID(),
      branchId: ctx.branchId,
      ...data,
      authorId: ctx.actor.subject,
      readBy: [],
    });
    await event(
      req,
      'message.create',
      ctx.actor.subject,
      record._id || '',
      ctx.branchId,
    );
    res.status(201).json({ data: record });
  });
  scoped.post('/messages/:id/read', async (req, res) => {
    const ctx = res.locals.context;
    requirePermission(ctx.actor, 'messages.read');
    const record = await BranchMessage.findOneAndUpdate(
      { _id: uuid.parse(req.params.id), branchId: ctx.branchId },
      { $addToSet: { readBy: ctx.actor.subject } },
      { new: true },
    );
    if (!record) throw new HttpError(404, 'not_found');
    res.json({ data: record });
  });
  scoped.get('/expenses', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      data: await listExpenses(res.locals.context, listQuery.parse(req.query)),
    });
  });
  scoped.get('/settings', async (_req, res) =>
    res.json({ data: await settingsRead(res.locals.context) }),
  );
  scoped.get('/users', async (_req, res) =>
    res.json({ data: await usersRead(res.locals.context) }),
  );
  scoped.get('/dashboard', async (req, res) =>
    res.json({
      data: present(
        await report(res.locals.context, listQuery.parse(req.query), true),
        res.locals.context,
      ),
    }),
  );
  scoped.get('/reports', async (req, res) =>
    res.json({
      data: present(
        await report(res.locals.context, listQuery.parse(req.query)),
        res.locals.context,
      ),
    }),
  );
  scoped.get('/reports/export', async (req, res) => {
    const format = z.enum(['csv', 'excel']).parse(req.query.format);
    const output = await exportReport(
      res.locals.context,
      listQuery.parse(req.query),
      format,
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="transactions.${format === 'csv' ? 'csv' : 'xml'}"`,
    );
    res
      .type(format === 'csv' ? 'text/csv' : 'application/vnd.ms-excel')
      .send(output);
  });
  scoped.get('/customers/:id', async (req, res) =>
    res.json({
      data: await customerDetail(res.locals.context, uuid.parse(req.params.id)),
    }),
  );
  scoped.get('/transactions/:id', async (req, res) =>
    res.json({
      data: await transactionDetail(
        res.locals.context,
        uuid.parse(req.params.id),
      ),
    }),
  );
  scoped.get('/invoices/:id', async (req, res) =>
    res.json({
      data: await invoiceDetail(res.locals.context, uuid.parse(req.params.id)),
    }),
  );
  scoped.get('/:resource/:id', async (req, res) => {
    requirePermission(res.locals.context.actor, 'catalog.read');
    const resource = z
      .enum(['products', 'product-categories', 'guarantees', 'package-items'])
      .parse(req.params.resource);
    const record = await catalogModels[resource]
      .findOne({
        _id: uuid.parse(req.params.id),
        branchId: res.locals.context.branchId,
      })
      .lean();
    if (!record) throw new HttpError(404, 'not_found');
    res.json({ data: present(record, res.locals.context) });
  });
  scoped.post('/:resource', async (req, res) => {
    const resource = z
      .enum([
        'products',
        'product-categories',
        'guarantees',
        'package-items',
        'customers',
        'transactions',
        'payments',
        'invoices',
        'devices',
      ])
      .parse(req.params.resource);
    const action =
      resource === 'customers'
        ? 'customer.create'
        : resource === 'transactions'
          ? 'transaction.create'
          : resource === 'payments'
            ? 'payment.create'
            : resource === 'invoices'
              ? 'invoice.issue'
              : resource === 'devices'
                ? 'device.register'
                : 'catalog.create';
    res.status(201).json({
      data: present(
        await executeCommand(res.locals.context, {
          operationId: req.get('idempotency-key'),
          deviceId: req.get('x-device-id'),
          action,
          ...(action === 'catalog.create' ? { resource } : {}),
          data: req.body,
        }),
        res.locals.context,
      ),
    });
  });
  scoped.patch('/:resource/:id', async (req, res) => {
    const resource = z
      .enum([
        'products',
        'product-categories',
        'guarantees',
        'package-items',
        'customers',
        'delivery',
      ])
      .parse(req.params.resource);
    res.json({
      data: present(
        await executeCommand(res.locals.context, {
          operationId: req.get('idempotency-key'),
          deviceId: req.get('x-device-id'),
          action:
            resource === 'customers'
              ? 'customer.update'
              : resource === 'delivery'
                ? 'delivery.update'
                : 'catalog.update',
          targetId: uuid.parse(req.params.id),
          expectedVersion: Number(req.get('if-match')),
          ...(resource !== 'customers' && resource !== 'delivery'
            ? { resource }
            : {}),
          data: req.body,
        }),
        res.locals.context,
      ),
    });
  });
  scoped.get('/:resource', async (req, res) =>
    res.json({
      data: await resourceList(
        res.locals.context,
        String(req.params.resource),
        listQuery.parse(req.query),
      ),
    }),
  );
  router.use('/branches/:branchId', scoped);
  return router;
}
