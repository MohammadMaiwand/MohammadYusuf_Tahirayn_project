import { isActiveBranch, type ActiveBranchId } from '@myt/shared';
import { HttpError } from '../utils/errors.js';
export interface Principal {
  subject: string;
  branchIds: readonly string[];
}
export interface BranchScope {
  readonly branchId: ActiveBranchId;
  readonly subject: string;
}
export function authorizeBranch(
  principal: Principal | undefined,
  requested: string,
): BranchScope {
  if (!principal) throw new HttpError(401, 'Authentication required');
  if (!isActiveBranch(requested) || !principal.branchIds.includes(requested))
    throw new HttpError(403, 'Branch access denied');
  return Object.freeze({ branchId: requested, subject: principal.subject });
}
// Call only with a scope returned by server-side authorization. Never spread raw request filters.
export function scopedIdentity(scope: BranchScope, id: string) {
  return { _id: id, branchId: scope.branchId };
}
