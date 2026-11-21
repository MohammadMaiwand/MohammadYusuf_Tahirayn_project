import { useQuery } from '@tanstack/react-query';
import Messages from './BranchMessages';
import { useState } from 'react';
import {
  NotificationLink,
  NotificationCustomerLink,
  NotificationTitle,
} from '../../components/common/NotificationLink';
import { useTranslation } from 'react-i18next';
import type { Notification, Page } from '../../types/business';
import { BellRing, Clock3, LayoutGrid, List, Package } from 'lucide-react';
import { deadlineState } from './notificationTime';
import {
  useData,
  useFormat,
  useSave,
  Button,
  Loading,
  ErrorState,
  Empty,
  Pagination,
} from '../../components/common/ui';
import { mutate } from '../../offline/operations';
import {
  session,
  request,
  branch,
  allowed,
  selectBranch,
} from '../../services/api';
export default function NotificationsPage() {
  const { t, i18n } = useTranslation();
  const fmt = useFormat();
  const [unread, setUnread] = useState(false),
    [page, setPage] = useState(1);
  const [view, setView] = useState<'cards' | 'table'>(
    () =>
      (localStorage.getItem('myt-notifications-view') as
        'cards' | 'table' | null) || 'cards',
  );
  const [global, setGlobal] = useState(session()?.role === 'admin');
  const all = useQuery({
    queryKey: ['global-notifications', unread],
    queryFn: () =>
      request<Notification[]>(
        '/notifications/global' + (unread ? '?unread=true' : ''),
      ),
    enabled: global,
    refetchInterval: 30000,
  });
  const localQuery = useData<Page<Notification>>(
    `/notifications?page=${page}${unread ? '&unread=true' : ''}`,
    !global,
    30000,
  );
  const query = global
    ? {
        ...all,
        data: all.data
          ? { items: all.data, page: 1, total: all.data.length, limit: 100 }
          : undefined,
      }
    : localQuery;
  const mark = useSave(
    ({ record, read }: { record: Notification; read: boolean }) =>
      global
        ? request(`/notifications/${record._id}/read`, {
            method: 'POST',
            body: JSON.stringify({ read }),
          })
        : mutate('notification.read', { read }, { targetId: record._id }),
  );
  const dueTime = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kabul',
    }).format(new Date(value));
  const setDisplay = (next: 'cards' | 'table') => {
    setView(next);
    localStorage.setItem('myt-notifications-view', next);
  };
  return (
    <>
      <div className="page-heading">
        <h1>{t('nav.notifications')}</h1>
        {session()?.role === 'admin' && (
          <select
            aria-label={t('auth.branch')}
            value={global ? 'all' : branch()}
            onChange={(e) => {
              if (e.target.value === 'all') setGlobal(true);
              else {
                setGlobal(false);
                void selectBranch(e.target.value).then(() => {
                  localStorage.setItem('myt-branch', e.target.value);
                  window.dispatchEvent(new Event('myt-identity-changed'));
                });
              }
            }}
          >
            <option value="all">{t('auth.allBranches')}</option>
            {session()!.branchIds.map((id) => (
              <option key={id} value={id}>
                {t('branch.' + id)}
              </option>
            ))}
          </select>
        )}
        <label className="check">
          <input
            type="checkbox"
            checked={unread}
            onChange={(e) => {
              setUnread(e.target.checked);
              setPage(1);
            }}
          />
          {t('notification.onlyUnread')}
        </label>
        <div
          className="notifications-view-toggle"
          role="group"
          aria-label={t('notification.display')}
        >
          <Button
            className="secondary"
            aria-pressed={view === 'cards'}
            onClick={() => setDisplay('cards')}
          >
            <LayoutGrid size={18} /> {t('notification.cards')}
          </Button>
          <Button
            className="secondary"
            aria-pressed={view === 'table'}
            onClick={() => setDisplay('table')}
          >
            <List size={18} /> {t('notification.table')}
          </Button>
        </div>
      </div>
      <p className="notifications-info" role="status">
        <BellRing size={17} /> {t('workflow.messaging')}
      </p>
      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : !query.data?.items.length ? (
        <Empty />
      ) : (
        <section className="notifications-page">
          {view === 'cards' ? (
            <div className="notifications-cards">
              {query.data.items.map((record) => {
                const read = record.readBy.includes(session()!.subject);
                const timing = deadlineState(record.reservationAt);
                return (
                  <article
                    className={`notifications-card is-${timing} ${read ? 'is-read' : 'is-unread'}`}
                    key={record._id}
                  >
                    <header>
                      <span className={`notifications-status is-${timing}`}>
                        <Clock3 size={16} />
                        {t(`notification.deadline.${timing}`)}
                      </span>
                      {!read && (
                        <span
                          className="notifications-unread-dot"
                          aria-label={t('notification.state.unread')}
                        />
                      )}
                    </header>
                    <div className="notifications-card-customer">
                      <span>{t('dashboard.customers')}</span>
                      <NotificationCustomerLink record={record}>
                        {record.customerName}
                      </NotificationCustomerLink>
                    </div>
                    <div className="notifications-card-garment">
                      <Package size={19} />
                      <NotificationLink record={record}>
                        <strong>
                          {record.productName || record.garmentId}
                        </strong>
                        {record.garmentId && <small>{record.garmentId}</small>}
                      </NotificationLink>
                    </div>
                    <div className="notifications-card-footer">
                      <strong dir="ltr">
                        {record.amountMinor !== undefined && record.currency
                          ? fmt.money(record.amountMinor, record.currency)
                          : '—'}
                      </strong>
                      <time dateTime={record.reservationAt}>
                        <span>{fmt.date(record.reservationAt)}</span>
                        <b>{dueTime(record.reservationAt)}</b>
                      </time>
                    </div>
                    <Button
                      className="ghost notifications-read-button"
                      disabled={mark.isPending}
                      onClick={() => mark.mutate({ record, read: !read })}
                    >
                      {t(read ? 'notification.unread' : 'notification.read')}
                    </Button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="table-scroll">
              <table className="notifications-table">
                <thead>
                  <tr>
                    <th>{t('notification.deadlineLabel')}</th>
                    {global && <th>{t('companyReport.branch')}</th>}
                    <th>{t('dashboard.customers')}</th>
                    <th>{t('notification.details')}</th>
                    <th>{t('notification.price')}</th>
                    <th>{t('notification.dueTime')}</th>
                    <th>{t('notification.created')}</th>
                    <th>{t('notification.readState')}</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.items.map((record) => {
                    const read = record.readBy.includes(session()!.subject);
                    const timing = deadlineState(record.reservationAt);
                    return (
                      <tr className={`is-${timing}`} key={record._id}>
                        <td>
                          <span className={`notifications-status is-${timing}`}>
                            {t(`notification.deadline.${timing}`)}
                          </span>
                        </td>
                        {global && <td>{t('branch.' + record.branchId)}</td>}
                        <td>
                          <NotificationCustomerLink record={record}>
                            {record.customerName}
                          </NotificationCustomerLink>
                        </td>
                        <td className="notifications-detail-cell">
                          <NotificationLink record={record}>
                            <NotificationTitle record={record} />
                          </NotificationLink>
                          <small>
                            {record.productName}
                            {record.garmentId ? ` · ${record.garmentId}` : ''}
                            {' · '}
                            {record.alterationId
                              ? t('nav.alterations')
                              : record.transactionType}
                          </small>
                        </td>
                        <td dir="ltr">
                          {record.amountMinor !== undefined && record.currency
                            ? fmt.money(record.amountMinor, record.currency)
                            : '—'}
                        </td>
                        <td>
                          {fmt.date(record.reservationAt)} ·{' '}
                          {dueTime(record.reservationAt)}
                        </td>
                        <td>{fmt.date(record.createdAt)}</td>
                        <td>
                          {t(
                            read
                              ? 'notification.state.read'
                              : 'notification.state.unread',
                          )}
                        </td>
                        <td>
                          <Button
                            className="ghost"
                            disabled={mark.isPending}
                            onClick={() => mark.mutate({ record, read: !read })}
                          >
                            {t(
                              read
                                ? 'notification.unread'
                                : 'notification.read',
                            )}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <Pagination data={query.data} onPage={setPage} />
        </section>
      )}
      {allowed('messages.read') && <Messages />}
    </>
  );
}
