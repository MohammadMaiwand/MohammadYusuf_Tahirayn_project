import mongoose from 'mongoose';
import {
  alterationReplay,
  alterationWrite,
  alterationStatus,
} from '../modules/alterations/service.js';
import { notificationAudience } from '../security/notificationAudience.js';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  commandSchema,
  registrationInput,
  branchCurrency,
  settingsInput,
  moneyToMinor,
  type Command,
  type Permission,
  effectivePermissions,
} from '@myt/shared';
import {
  SyncOperation,
  Device,
  BranchSettings,
  Branch,
  Notification,
  User,
  type TransactionRecord,
} from '../database/models.js';
import { catalogWrite, customerWrite } from '../modules/catalog/service.js';
import {
  transactionCreate,
  transactionUpdate,
  deliveryUpdate,
} from '../modules/transactions/service.js';
import { paymentCreate, paymentReverse } from '../modules/payments/service.js';
import { issueInvoice } from '../modules/invoices/service.js';
import { requirePermission, type Context } from '../security/identity.js';
import { base, found, checkVersion, audit } from './context.js';
import { HttpError } from '../utils/errors.js';
import { createExpense } from '../modules/expenses/service.js';
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => `${JSON.stringify(key)}:${stable(val)}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
const actionPermissions: Partial<Record<Command['action'], Permission>> = {
  'customer.register': 'customers.write',
  'transaction.update': 'transactions.update',
  'customer.create': 'customers.write',
  'customer.update': 'customers.write',
  'expense.create': 'expenses.create',
  'alteration.create': 'alterations.create',
  'alteration.update': 'alterations.update',
  'alteration.status': 'alterations.status',
  'transaction.create': 'transactions.create',
  'payment.create': 'payments.create',
  'payment.reverse': 'payments.reverse',
  'delivery.update': 'delivery.write',
  'invoice.issue': 'invoices.issue',
  'settings.update': 'settings.write',
  'notification.read': 'notifications.read',
  'user.grants': 'users.manage',
};
export async function executeCommand(
  ctx: Context,
  input: unknown,
  offline = false,
): Promise<unknown> {
  const command = commandSchema.parse(input);
  if (!ctx.actor.development) {
    const user = found(await User.findById(ctx.actor.subject).lean());
    if (
      user.disabled ||
      user.accountStatus !== 'active' ||
      !user.branchIds.includes(ctx.branchId)
    )
      throw new HttpError(403, 'branch_denied');
    const effective = effectivePermissions(user.role, user.allow, user.deny);
    ctx = {
      ...ctx,
      actor: {
        ...ctx.actor,
        role: user.role,
        branchIds: user.branchIds,
        permissions: effective,
      },
    };
  }
  const registeredDevice = await Device.findOne({
    branchId: ctx.branchId,
    ownerId: ctx.actor.subject,
    deviceId: command.deviceId,
  }).lean();
  if (
    registeredDevice?.revoked ||
    (!registeredDevice && command.action !== 'device.register')
  )
    throw new HttpError(403, 'device_not_registered');
  const permission = actionPermissions[command.action];
  if (permission) requirePermission(ctx.actor, permission);
  if (offline) {
    requirePermission(ctx.actor, 'offline.write');
    if (
      ![
        'customer.register',
        'customer.create',
        'customer.update',
        'catalog.create',
        'catalog.update',
        'transaction.create',
        'payment.create',
      ].includes(command.action)
    )
      throw new HttpError(403, 'offline_action_denied');
  }
  const key = {
    branchId: ctx.branchId,
    actorId: ctx.actor.subject,
    operationId: command.operationId,
  };
  const requestHash = createHash('sha256')
    .update(stable(command))
    .digest('hex');
  const previous = await SyncOperation.findOne(key).lean();
  if (previous) {
    if (previous.requestHash !== requestHash)
      throw new HttpError(409, 'idempotency_mismatch');
    return command.action.startsWith('alteration.')
      ? alterationReplay(ctx, previous.result)
      : previous.result;
  }
  try {
    return await mongoose.connection.transaction(
      async (session) => {
        const duplicate = await SyncOperation.findOne(key)
          .session(session)
          .lean();
        if (duplicate) {
          if (duplicate.requestHash !== requestHash)
            throw new HttpError(409, 'idempotency_mismatch');
          return command.action.startsWith('alteration.')
            ? alterationReplay(ctx, duplicate.result)
            : duplicate.result;
        }
        if (command.action !== 'device.register') {
          const device = await Device.findOne({
            branchId: ctx.branchId,
            ownerId: ctx.actor.subject,
            deviceId: command.deviceId,
            revoked: false,
          }).session(session);
          if (!device) throw new HttpError(403, 'device_not_registered');
        }
        let result: unknown;
        switch (command.action) {
          case 'alteration.create':
          case 'alteration.update':
            result = await alterationWrite(ctx, command, session);
            break;
          case 'alteration.status':
            result = await alterationStatus(ctx, command, session);
            break;
          case 'expense.create':
            result = await createExpense(ctx, command, session);
            break;
          case 'catalog.create':
          case 'catalog.update':
            result = await catalogWrite(ctx, command, session);
            break;
          case 'customer.register': {
            const data = registrationInput.parse(command.data);
            const customer = await customerWrite(
              ctx,
              { ...command, action: 'customer.create', data: data.customer },
              session,
            );
            const transaction = await transactionCreate(
              ctx,
              {
                ...command,
                action: 'transaction.create',
                data: { ...data.transaction, customerId: customer._id },
              },
              session,
              offline,
            );
            result = { customer, transaction };
            break;
          }
          case 'transaction.update':
            result = await transactionUpdate(ctx, command, session);
            break;
          case 'customer.create':
          case 'customer.update':
            result = await customerWrite(ctx, command, session);
            break;
          case 'transaction.create':
            result = await transactionCreate(ctx, command, session, offline);
            break;
          case 'payment.create':
            result = await paymentCreate(ctx, command, session, offline);
            break;
          case 'payment.reverse':
            result = await paymentReverse(ctx, command, session);
            break;
          case 'delivery.update':
            result = await deliveryUpdate(ctx, command, session);
            break;
          case 'invoice.issue':
            result = await issueInvoice(ctx, command, session);
            break;
          case 'device.register': {
            const data = z
              .object({ label: z.string().trim().min(1).max(100) })
              .strict()
              .parse(command.data);
            const existing = await Device.findOne({
              branchId: ctx.branchId,
              ownerId: ctx.actor.subject,
              deviceId: command.deviceId,
            }).session(session);
            if (existing?.revoked) throw new HttpError(403, 'device_revoked');
            result =
              existing?.toObject() ??
              (
                await Device.create(
                  [
                    {
                      ...base(ctx, 'DEV'),
                      ownerId: ctx.actor.subject,
                      deviceId: command.deviceId,
                      label: data.label,
                      revoked: false,
                      lastSeenAt: new Date(),
                    },
                  ],
                  { session },
                )
              )[0]!.toObject();
            await audit(
              ctx,
              session,
              command.deviceId,
              command.action,
              'devices',
              command.deviceId,
              null,
              { registered: true },
            );
            break;
          }
          case 'settings.update': {
            const data = settingsInput.parse(command.data);
            const record = found(
              await BranchSettings.findOne({ branchId: ctx.branchId }).session(
                session,
              ),
            );
            checkVersion(record, data.expectedVersion);
            if (data.currency !== branchCurrency(ctx.branchId))
              throw new HttpError(422, 'currency_locked');
            if (data.branchName)
              await Branch.updateOne(
                { _id: ctx.branchId },
                { $set: { name: data.branchName } },
                { session },
              );
            const { offlinePaymentLimit } = data;
            const fields = {
              currency: data.currency,
              paymentMethods: data.paymentMethods,
              offlinePayments: data.offlinePayments,
              companyName: data.companyName,
              address: data.address,
              telephone: data.telephone,
            };
            record.set({
              ...fields,
              offlinePaymentLimitMinor: moneyToMinor(offlinePaymentLimit),
            });
            record.version++;
            await record.save({ session });
            await audit(
              ctx,
              session,
              command.deviceId,
              command.action,
              'branchSettings',
              record._id,
              { version: record.version - 1 },
              { version: record.version },
            );
            result = record.toObject();
            break;
          }
          case 'notification.read': {
            const data = z
              .object({ read: z.boolean() })
              .strict()
              .parse(command.data);
            const record = found(
              await Notification.findOne({
                _id: command.targetId,
                branchId: ctx.branchId,
                ...notificationAudience(ctx.actor),
              }).session(session),
            );
            record.readBy = data.read
              ? [...new Set([...record.readBy, ctx.actor.subject])]
              : record.readBy.filter((id) => id !== ctx.actor.subject);
            record.version++;
            await record.save({ session });
            await audit(
              ctx,
              session,
              command.deviceId,
              command.action,
              'notifications',
              record._id,
              null,
              { read: data.read },
            );
            result = record.toObject();
            break;
          }
          case 'user.grants': {
            throw new HttpError(410, 'use_account_management');
          }
          case 'preferences.update': {
            const data = z
              .object({ language: z.enum(['en', 'fa-AF', 'ps-AF']) })
              .strict()
              .parse(command.data);
            if (!ctx.actor.development) {
              const user = found(
                await User.findById(ctx.actor.subject).session(session),
              );
              user.language = data.language;
              await user.save({ session });
            }
            await audit(
              ctx,
              session,
              command.deviceId,
              command.action,
              'preferences',
              ctx.actor.subject,
              null,
              { language: data.language },
            );
            result = data;
            break;
          }
        }
        if (
          [
            'customer.register',
            'transaction.update',
            'transaction.create',
            'delivery.update',
            'payment.create',
            'payment.reverse',
          ].includes(command.action)
        ) {
          const value = result as TransactionRecord & {
            transaction?: TransactionRecord;
          };
          const transaction = value.transaction || value;
          const type = offline
            ? 'sync'
            : command.action.startsWith('payment.')
              ? 'payment'
              : 'transaction';
          await Notification.create(
            [
              {
                ...base(ctx, 'NOT'),
                eventId: `${ctx.actor.subject}:${command.operationId}`,
                transactionId: transaction._id,
                customerId: transaction.customerId,
                customerName: transaction.customerName,
                productName: transaction.product.name,
                transactionType: transaction.type,
                reservationAt: transaction.reservationAt,
                type,
                ownerId: transaction.createdBy,
                readBy: [],
                resolved: false,
              },
            ],
            { session },
          );
        }
        await SyncOperation.create(
          [
            {
              ...base(ctx, 'OP'),
              ...key,
              deviceId: command.deviceId,
              requestHash,
              action: command.action,
              result: JSON.parse(JSON.stringify(result)),
            },
          ],
          { session },
        );
        return result;
      },
      { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } },
    );
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    ) {
      const stored = await SyncOperation.findOne(key).lean();
      if (stored) {
        if (stored.requestHash !== requestHash)
          throw new HttpError(409, 'idempotency_mismatch');
        return command.action.startsWith('alteration.')
          ? alterationReplay(ctx, stored.result)
          : stored.result;
      }
      throw new HttpError(409, 'duplicate_record');
    }
    throw error;
  }
}
