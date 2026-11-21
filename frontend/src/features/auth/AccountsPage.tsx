import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  branches,
  effectivePermissions,
  type Permission,
  type Role,
} from '@myt/shared';
import * as api from '../../services/api';
import {
  Button,
  Field,
  Modal,
  Loading,
  ErrorState,
  useSave,
  useFormat,
} from '../../components/common/ui';
interface Account {
  _id: string;
  name: string;
  email: string;
  role: Role;
  branchIds: string[];
  assignedBranchId: string | null;
  allow: Permission[];
  deny: Permission[];
  accountStatus: string;
  language: string;
  grantVersion: number;
  createdAt: string;
  lastLoginAt?: string;
}
const adminOnly = [
  'users.manage',
  'users.create',
  'users.update',
  'users.password',
  'permissions.assign',
  'sessions.manage',
  'security.read',
  'global.read',
  'settings.write',
];
function AccountForm({
  account,
  onClose,
  permitted,
}: {
  account?: Account | undefined;
  onClose: () => void;
  permitted: Permission[];
}) {
  const { t } = useTranslation();
  const actor = api.session()!;
  const [data, setData] = useState({
      name: account?.name || '',
      email: account?.email || '',
      role: account?.role || ('employee' as Role),
      branchId: account?.assignedBranchId || actor.branchIds[0]!,
      allow: account?.allow || ([] as Permission[]),
      deny: account?.deny || ([] as Permission[]),
      accountStatus: account?.accountStatus || 'active',
      language: account?.language || 'fa-AF',
    }),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState('');
  const choices = permitted.filter(
    (p) => data.role !== 'employee' || !adminOnly.includes(p),
  );
  const effective = (p: Permission) =>
    effectivePermissions(data.role, data.allow, data.deny).includes(p);
  function toggle(p: Permission, on: boolean) {
    setData({
      ...data,
      allow: on
        ? [...new Set([...data.allow, p])]
        : data.allow.filter((v) => v !== p),
      deny: on
        ? data.deny.filter((v) => v !== p)
        : [...new Set([...data.deny, p])],
    });
  }
  const groups = [...new Set(choices.map((p) => p.split('.')[0]!))];
  const save = useSave(
    async () => {
      if (!account && password !== confirm)
        throw new api.ApiError(422, 'password_mismatch');
      if (!window.confirm(t('auth.confirmGrants'))) return false;
      return api.request(account ? `/users/${account._id}` : '/users', {
        method: account ? 'PATCH' : 'POST',
        body: JSON.stringify({
          ...data,
          branchId: data.role === 'admin' ? null : data.branchId,
          ...(account
            ? { expectedVersion: account.grantVersion }
            : { password }),
        }),
      });
    },
    (result) => {
      if (result !== false) onClose();
    },
  );
  return (
    <Modal
      size="large"
      title={account ? 'auth.editAccount' : 'auth.newAccount'}
      onClose={onClose}
    >
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <Field label="auth.role">
          <select
            value={data.role}
            onChange={(e) =>
              setData({
                ...data,
                role: e.target.value as Role,
                allow: [],
                deny: [],
              })
            }
          >
            {(actor.role === 'admin'
              ? ['admin', 'manager', 'employee']
              : ['employee']
            ).map((r) => (
              <option key={r} value={r}>
                {t('session.' + r)}
              </option>
            ))}
          </select>
        </Field>
        {data.role !== 'admin' && (
          <Field label="auth.branch">
            <select
              value={data.branchId}
              onChange={(e) => setData({ ...data, branchId: e.target.value })}
            >
              {branches
                .filter((b) => b.active && actor.branchIds.includes(b.id))
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {t('branch.' + b.id)}
                  </option>
                ))}
            </select>
          </Field>
        )}
        <Field label="auth.name">
          <input
            required
            maxLength={160}
            value={data.name}
            onChange={(e) => setData({ ...data, name: e.target.value })}
          />
        </Field>
        <Field label="auth.email">
          <input
            required
            type="email"
            dir="ltr"
            value={data.email}
            onChange={(e) =>
              setData({ ...data, email: e.target.value.trim().toLowerCase() })
            }
          />
        </Field>
        {!account && (
          <>
            <Field label="auth.password">
              <input
                required
                type="password"
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Field label="auth.confirmPassword">
              <input
                required
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </Field>
            <p className="account-form-wide">{t('auth.policy')}</p>
          </>
        )}
        <Field label="auth.status">
          <select
            value={data.accountStatus}
            onChange={(e) =>
              setData({ ...data, accountStatus: e.target.value })
            }
          >
            {['active', 'suspended', 'deactivated'].map((s) => (
              <option key={s} value={s}>
                {t('auth.' + s)}
              </option>
            ))}
          </select>
        </Field>
        <div className="account-form-wide">
          <h3>{t('auth.permissions')}</h3>
          <div className="session-toolbar">
            <Button
              type="button"
              className="secondary"
              onClick={() => setData({ ...data, allow: choices, deny: [] })}
            >
              {t('auth.selectAll')}
            </Button>
            <Button
              type="button"
              className="ghost"
              onClick={() => setData({ ...data, allow: [], deny: choices })}
            >
              {t('auth.deselectAll')}
            </Button>
          </div>
        </div>
        <div className="permissions-grid">
          {groups.map((group) => (
            <details key={group} open>
              <summary>
                {
                  t(
                    'permission.' +
                      choices.find((p) => p.startsWith(group + '.')),
                  ).split(':')[0]
                }
              </summary>
              {choices
                .filter((p) => p.startsWith(group + '.'))
                .map((p) => (
                  <label key={p}>
                    <input
                      type="checkbox"
                      checked={effective(p)}
                      onChange={(e) => toggle(p, e.target.checked)}
                    />
                    {t('permission.' + p)}
                  </label>
                ))}
            </details>
          ))}
        </div>
        {save.error && <ErrorState error={save.error} />}
        <div className="form-actions">
          <Button type="button" className="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={save.isPending}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function Reset({
  account,
  onClose,
}: {
  account: Account;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState('');
  const save = useSave(async () => {
    if (password !== confirm) throw new api.ApiError(422, 'password_mismatch');
    return api.request(`/users/${account._id}/password`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  }, onClose);
  return (
    <Modal title="auth.resetPassword" onClose={onClose}>
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <p>
          {account.name} · {t('auth.policy')}
        </p>
        <Field label="auth.password">
          <input
            required
            type="password"
            minLength={8}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        <Field label="auth.confirmPassword">
          <input
            required
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        {save.error && <ErrorState error={save.error} />}
        <Button type="submit" loading={save.isPending}>
          {t('common.save')}
        </Button>
      </form>
    </Modal>
  );
}
export default function AccountsPage() {
  const { t } = useTranslation(),
    fmt = useFormat();
  const [edit, setEdit] = useState<Account | null | undefined>(),
    [reset, setReset] = useState<Account>();
  const query = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.request<Account[]>('/users'),
    gcTime: 0,
  });
  const matrix = useQuery({
    queryKey: ['account-permissions'],
    queryFn: () => api.request<{ permissions: Permission[] }>('/permissions'),
    gcTime: 0,
  });
  return (
    <>
      <div className="page-heading">
        <h1>{t('auth.accounts')}</h1>
        {api.allowed('users.create') && (
          <Button onClick={() => setEdit(null)}>{t('auth.newAccount')}</Button>
        )}
      </div>
      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} />
      ) : (
        <section className="panel table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  'auth.name',
                  'auth.email',
                  'auth.role',
                  'auth.branch',
                  'auth.status',
                  'auth.lastLogin',
                  'auth.created',
                  'common.actions',
                ].map((k) => (
                  <th key={k}>{t(k)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {query.data?.map((user) => (
                <tr key={user._id}>
                  <td>{user.name}</td>
                  <td dir="ltr">{user.email || '—'}</td>
                  <td>{t('session.' + user.role)}</td>
                  <td>
                    {user.role === 'admin'
                      ? t('auth.allBranches')
                      : t('branch.' + user.branchIds[0])}
                  </td>
                  <td>{t('auth.' + user.accountStatus)}</td>
                  <td>{user.lastLoginAt ? fmt.date(user.lastLoginAt) : '—'}</td>
                  <td>{fmt.date(user.createdAt)}</td>
                  <td>
                    {user._id !== api.session()?.subject && (
                      <div className="row-actions">
                        {api.allowed('users.update') && (
                          <Button
                            className="ghost"
                            onClick={() => setEdit(user)}
                          >
                            {t('common.edit')}
                          </Button>
                        )}
                        {api.allowed('users.password') && (
                          <Button
                            className="ghost"
                            onClick={() => setReset(user)}
                          >
                            {t('auth.resetPassword')}
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {matrix.error && <ErrorState error={matrix.error} />}
      <div className="account-modal">
        {edit !== undefined && matrix.data && (
          <AccountForm
            account={edit || undefined}
            permitted={matrix.data.permissions}
            onClose={() => setEdit(undefined)}
          />
        )}
      </div>
      {reset && <Reset account={reset} onClose={() => setReset(undefined)} />}
    </>
  );
}
