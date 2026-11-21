import { randomUUID } from 'node:crypto';
import type { ClientSession } from 'mongoose';
import { AuditLog, type BaseRecord } from '../database/models.js';
import type { Context } from '../security/identity.js';
import { HttpError } from '../utils/errors.js';
export function base(ctx: Context, prefix: string, id: string = randomUUID()) {
  return {
    _id: id,
    branchId: ctx.branchId,
    code: `${prefix}-${id.toUpperCase()}`,
    version: 1,
    createdBy: ctx.actor.subject,
  };
}
export function found<T>(record: T | null | undefined): T {
  if (!record) throw new HttpError(404, 'not_found');
  return record;
}
export function checkVersion(
  record: Pick<BaseRecord, 'version'>,
  expected: number | undefined,
) {
  if (expected === undefined || record.version !== expected)
    throw new HttpError(409, 'version_conflict');
}
export async function audit(
  ctx: Context,
  session: ClientSession,
  deviceId: string,
  action: string,
  resource: string,
  recordId: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
) {
  await AuditLog.create(
    [
      {
        ...base(ctx, 'AUD'),
        actorId: ctx.actor.subject,
        deviceId,
        action,
        resource,
        recordId,
        before,
        after,
      },
    ],
    { session },
  );
}
export function summary(record: {
  version: number;
  status?: string;
  totalMinor?: number;
  paidMinor?: number;
}) {
  return {
    version: record.version,
    ...(record.status ? { status: record.status } : {}),
    ...(record.totalMinor !== undefined
      ? { totalMinor: record.totalMinor, paidMinor: record.paidMinor }
      : {}),
  };
}
