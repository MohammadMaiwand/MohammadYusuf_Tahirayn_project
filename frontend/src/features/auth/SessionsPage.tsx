import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import * as api from '../../services/api';
import {
  Button,
  Field,
  Loading,
  ErrorState,
  useSave,
  useFormat,
} from '../../components/common/ui';
interface Session {
  _id: string;
  userId: string;
  device: string;
  ip: string;
  expiresAt: string;
  lastSeenAt: string;
}
interface Event {
  _id: string;
  userId: string;
  action: string;
  targetId: string;
  createdAt: string;
  ip: string;
}
export default function SessionsPage() {
  const { t } = useTranslation(),
    fmt = useFormat();
  const [current, setCurrent] = useState(''),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState('');
  const sessions = useQuery({
    queryKey: ['auth-sessions'],
    queryFn: () => api.request<Session[]>('/sessions'),
    gcTime: 0,
  });
  const audit = useQuery({
    queryKey: ['security-audit'],
    queryFn: () => api.request<Event[]>('/security/audit'),
    enabled: api.session()?.role === 'admin' && api.allowed('security.read'),
    gcTime: 0,
  });
  const revoke = useSave((id: string) =>
    api.request(`/sessions/${id}`, { method: 'DELETE' }),
  );
  const change = useSave(async () => {
    if (password !== confirm) throw new api.ApiError(422, 'password_mismatch');
    await api.request('/auth/password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: current, password }),
    });
    await api.endSession();
  });
  const [exitError, setExitError] = useState<unknown>();
  return (
    <>
      <div className="page-heading">
        <h1>{t('auth.sessions')}</h1>
        <div className="session-toolbar">
          <Button onClick={() => void api.endSession().catch(setExitError)}>
            {t('auth.logout')}
          </Button>
          <Button
            className="secondary"
            onClick={() =>
              void api
                .request('/auth/logout-all', { method: 'POST' })
                .then(api.endSession)
                .catch(setExitError)
            }
          >
            {t('auth.logoutAll')}
          </Button>
        </div>
      </div>
      {exitError !== undefined && <ErrorState error={exitError} />}
      <section className="panel" style={{ padding: 24 }}>
        <h2>{t('auth.changePassword')}</h2>
        <p>{t('auth.policy')}</p>
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            change.mutate();
          }}
        >
          <Field label="auth.currentPassword">
            <input
              type="password"
              required
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </Field>
          <Field label="auth.password">
            <input
              type="password"
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Field label="auth.confirmPassword">
            <input
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
          <Button type="submit" disabled={change.isPending}>
            {t('auth.changePassword')}
          </Button>
          {change.error && <ErrorState error={change.error} />}
        </form>
      </section>
      {sessions.isLoading ? (
        <Loading />
      ) : sessions.error ? (
        <ErrorState error={sessions.error} />
      ) : (
        <section className="panel table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  'auth.name',
                  'auth.device',
                  'auth.expires',
                  'common.actions',
                ].map((key) => (
                  <th key={key}>{t(key)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.data?.map((row) => (
                <tr key={row._id}>
                  <td>{row.userId}</td>
                  <td>
                    {row.device}
                    <br />
                    {row.ip}
                  </td>
                  <td>{fmt.date(row.expiresAt)}</td>
                  <td>
                    <Button
                      disabled={revoke.isPending}
                      onClick={() => revoke.mutate(row._id)}
                    >
                      {t('auth.revoke')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {audit.data && (
        <section className="panel table-scroll">
          <h2>{t('auth.security')}</h2>
          <table>
            <tbody>
              {audit.data.map((row) => (
                <tr key={row._id}>
                  <td>
                    {t('security.' + row.action, { defaultValue: row.action })}
                  </td>
                  <td>{row.userId}</td>
                  <td>{fmt.date(row.createdAt)}</td>
                  <td>{row.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
