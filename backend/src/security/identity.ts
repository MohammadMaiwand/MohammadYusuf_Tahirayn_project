import type { Request } from 'express';
import {
  branches,
  rolePermissions,
  type Permission,
  type SessionIdentity,
} from '@myt/shared';
import { HttpError } from '../utils/errors.js';
import { sessionIdentity } from '../modules/auth/core.js';
import type { Environment } from '../config/env.js';
export type Actor = SessionIdentity;
export interface Context {
  actor: Actor;
  branchId: string;
}
export function has(actor: Actor, permission: Permission) {
  return (
    actor.permissions.includes(permission) ||
    (permission === 'transactions.read.own' &&
      actor.permissions.includes('transactions.read.all'))
  );
}
export function requirePermission(actor: Actor, permission: Permission) {
  if (!has(actor, permission)) throw new HttpError(403, 'forbidden');
}
export function context(actor: Actor, requested: string): Context {
  if (
    !branches.some((b) => b.id === requested && b.active) ||
    !actor.branchIds.includes(requested)
  )
    throw new HttpError(403, 'branch_denied');
  return { actor, branchId: requested };
}
export function ownFilter(ctx: Context) {
  return has(ctx.actor, 'transactions.read.all')
    ? {}
    : { createdBy: ctx.actor.subject };
}
export async function resolveIdentity(
  req: Request,
  env: Environment,
): Promise<Actor> {
  const expiresAt = new Date(Date.now() + 8 * 3600000).toISOString();
  if (env.DEV_IDENTITY_ENABLED === 'true') {
    if (
      env.NODE_ENV !== 'development' ||
      !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(
        req.socket.remoteAddress || '',
      )
    )
      throw new HttpError(403, 'development_identity_local_only');
    return {
      subject: `development-fixture:${env.DEV_ROLE}`,
      name: 'Development fixture',
      role: env.DEV_ROLE,
      branchIds:
        env.DEV_ROLE === 'admin'
          ? branches.filter((b) => b.active).map((b) => b.id)
          : [env.DEV_BRANCH_ID],
      permissions: [...rolePermissions[env.DEV_ROLE]],
      development: true,
      language: 'fa-AF',
      expiresAt,
    };
  }
  return sessionIdentity(req, env);
}
