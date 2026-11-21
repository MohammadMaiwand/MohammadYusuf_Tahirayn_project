import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { permissions, branches, type Permission } from '@myt/shared';
import type { UserGrant } from '../../types/business';
import {
  Button,
  Field,
  Modal,
  useData,
  useSave,
  Loading,
  ErrorState,
  Empty,
  Confirm,
} from '../../components/common/ui';
import { mutate } from '../../offline/operations';
function GrantEditor({
  user,
  onClose,
}: {
  user: UserGrant;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(user),
    [confirm, setConfirm] = useState(false);
  const save = useSave(
    () =>
      mutate(
        'user.grants',
        {
          role: draft.role,
          branchIds: draft.branchIds,
          allow: draft.allow,
          deny: draft.deny,
          disabled: draft.disabled,
          expectedVersion: user.grantVersion,
        },
        { targetId: user._id },
      ),
    onClose,
  );
  function toggle(
    field: 'allow' | 'deny',
    permission: Permission,
    value: boolean,
  ) {
    setDraft({
      ...draft,
      [field]: value
        ? [...draft[field], permission]
        : draft[field].filter((p) => p !== permission),
    });
  }
  return (
    <Modal title="nav.users" onClose={onClose}>
      <h3>{user.name}</h3>
      <Field label="field.role">
        <select
          value={draft.role}
          onChange={(e) =>
            setDraft({ ...draft, role: e.target.value as UserGrant['role'] })
          }
        >
          {['admin', 'manager', 'employee'].map((role) => (
            <option key={role} value={role}>
              {t(`session.${role}`)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="common.branch">
        <div>
          {branches
            .filter((b) => b.active)
            .map((branch) => (
              <label key={branch.id} className="check">
                <input
                  type="checkbox"
                  checked={draft.branchIds.includes(branch.id)}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      branchIds: e.target.checked
                        ? [...draft.branchIds, branch.id]
                        : draft.branchIds.filter((id) => id !== branch.id),
                    })
                  }
                />
                {t(`branch.${branch.id}`)}
              </label>
            ))}
        </div>
      </Field>
      <label className="check">
        <input
          type="checkbox"
          checked={draft.disabled}
          onChange={(e) => setDraft({ ...draft, disabled: e.target.checked })}
        />
        {t('field.disabled')}
      </label>
      <table>
        <thead>
          <tr>
            <th>{t('nav.users')}</th>
            <th>{t('field.allow')}</th>
            <th>{t('field.deny')}</th>
          </tr>
        </thead>
        <tbody>
          {permissions.map((permission) => (
            <tr key={permission}>
              <td>
                {t(`permission.${permission}`, { defaultValue: permission })}
              </td>
              <td>
                <input
                  aria-label={`${t('field.allow')} ${permission}`}
                  type="checkbox"
                  checked={draft.allow.includes(permission)}
                  onChange={(e) =>
                    toggle('allow', permission, e.target.checked)
                  }
                />
              </td>
              <td>
                <input
                  aria-label={`${t('field.deny')} ${permission}`}
                  type="checkbox"
                  checked={draft.deny.includes(permission)}
                  onChange={(e) => toggle('deny', permission, e.target.checked)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {save.error && <ErrorState error={save.error} />}
      <div className="form-actions">
        <Button
          disabled={!draft.branchIds.length || save.isPending}
          onClick={() => setConfirm(true)}
        >
          {t('common.save')}
        </Button>
      </div>
      {confirm && (
        <Confirm
          busy={save.isPending}
          onCancel={() => setConfirm(false)}
          onConfirm={() => save.mutate()}
        />
      )}
    </Modal>
  );
}
export default function UsersPage() {
  const { t } = useTranslation();
  const query = useData<UserGrant[]>('/users');
  const [edit, setEdit] = useState<UserGrant>();
  return (
    <>
      <div className="page-heading">
        <h1>{t('nav.users')}</h1>
      </div>
      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} />
      ) : !query.data?.length ? (
        <Empty />
      ) : (
        <section className="panel">
          <table>
            <thead>
              <tr>
                <th>{t('field.name')}</th>
                <th>{t('field.role')}</th>
                <th>{t('common.branch')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {query.data.map((user) => (
                <tr key={user._id}>
                  <td>{user.name}</td>
                  <td>{t(`session.${user.role}`)}</td>
                  <td>
                    {user.branchIds.map((id) => t(`branch.${id}`)).join('، ')}
                  </td>
                  <td>
                    <Button className="ghost" onClick={() => setEdit(user)}>
                      {t('common.edit')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {edit && <GrantEditor user={edit} onClose={() => setEdit(undefined)} />}
    </>
  );
}
