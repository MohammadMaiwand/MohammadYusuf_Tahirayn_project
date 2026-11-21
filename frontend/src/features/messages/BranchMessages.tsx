import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { request, branch, allowed, session } from '../../services/api';
import {
  Button,
  Field,
  ErrorState,
  useSave,
  useFormat,
} from '../../components/common/ui';
interface Message {
  _id: string;
  title: string;
  body: string;
  readBy: string[];
  createdAt: string;
}
export default function BranchMessages() {
  const { t } = useTranslation(),
    fmt = useFormat();
  const [title, setTitle] = useState(''),
    [body, setBody] = useState('');
  const query = useQuery({
    queryKey: [branch(), 'messages'],
    queryFn: () =>
      request<{ items: Message[] }>(`/branches/${branch()}/messages`),
    refetchInterval: 30000,
    gcTime: 0,
  });
  const save = useSave(
    () =>
      request(`/branches/${branch()}/messages`, {
        method: 'POST',
        body: JSON.stringify({ title, body }),
      }),
    () => {
      setTitle('');
      setBody('');
    },
  );
  const read = useSave((id: string) =>
    request(`/branches/${branch()}/messages/${id}/read`, { method: 'POST' }),
  );
  return (
    <section className="panel" style={{ padding: 24 }}>
      <h2>
        {t('auth.messages')} · {t('branch.' + branch())}
      </h2>
      {allowed('messages.write') && (
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Field label="auth.messageTitle">
            <input
              required
              maxLength={160}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field label="auth.messageBody">
            <textarea
              required
              maxLength={2000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </Field>
          <Button type="submit" loading={save.isPending}>
            {t('common.save')}
          </Button>
          {save.error && <ErrorState error={save.error} />}
        </form>
      )}
      {query.error && <ErrorState error={query.error} />}
      <div className="notification-list">
        {query.data?.items.map((row) => (
          <article key={row._id}>
            <div>
              <h3>{row.title}</h3>
              <p style={{ whiteSpace: 'pre-wrap' }}>{row.body}</p>
              <small>{fmt.date(row.createdAt)}</small>
            </div>
            {!row.readBy.includes(session()!.subject) && (
              <Button className="ghost" onClick={() => read.mutate(row._id)}>
                {t('notification.read')}
              </Button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
