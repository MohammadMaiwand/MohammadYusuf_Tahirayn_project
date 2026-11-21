import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  queue,
  retry,
  reconcile,
  synchronize,
  type Queued,
} from '../../offline/operations';
import { allowed, request, branch } from '../../services/api';
import type { Transaction, Entity } from '../../types/business';
import {
  Button,
  Modal,
  useFormat,
  useSave,
  ErrorState,
  Empty,
  toast,
} from '../../components/common/ui';
export default function SyncPage() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const [items, setItems] = useState<Queued[]>([]),
    [review, setReview] = useState<{
      item: Queued;
      latest: Entity & Partial<Transaction>;
    }>(),
    [error, setError] = useState<unknown>();
  useEffect(() => {
    const load = () => {
      void queue().then(setItems).catch(setError);
    };
    load();
    window.addEventListener('myt-sync-changed', load);
    return () => window.removeEventListener('myt-sync-changed', load);
  }, []);
  const resolve = useSave(
    () => reconcile(review!.item, review!.latest.version),
    () => setReview(undefined),
  );
  async function inspect(item: Queued) {
    try {
      const data = item.command.data as Record<string, unknown>;
      const resource =
        item.command.action === 'payment.create'
          ? 'transactions'
          : item.command.resource || 'customers';
      const id =
        item.command.action === 'payment.create'
          ? data.transactionId
          : item.command.targetId;
      const latest = await request<Entity & Partial<Transaction>>(
        `/branches/${branch()}/${resource}/${id}`,
      );
      setReview({ item, latest });
    } catch (err) {
      setError(err);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t('nav.sync')}</h1>
          <p className="muted">{t('sync.history')}</p>
        </div>
        <Button onClick={() => void synchronize()}>{t('sync.run')}</Button>
      </div>
      {error !== undefined && <ErrorState error={error} />}{' '}
      {!items.length ? (
        <Empty />
      ) : (
        <section className="panel">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {[
                    'common.actions',
                    'field.createdAt',
                    'field.status',
                    'field.description',
                    'common.actions',
                  ].map((key, index) => (
                    <th key={index}>{t(key)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.command.operationId}>
                    <td>
                      {t(`actionCode.${item.command.action}`, {
                        defaultValue: t('common.save'),
                      })}
                      <small className="code">{item.command.operationId}</small>
                    </td>
                    <td>{fmt.date(new Date(item.createdAt))}</td>
                    <td>
                      <span className={`badge sync-${item.status}`}>
                        {t(`sync.${item.status}`)}
                      </span>
                    </td>
                    <td>
                      {item.error
                        ? t(`error.${item.error}`, {
                            defaultValue: t('common.error'),
                          })
                        : '—'}
                    </td>
                    <td>
                      {['failed', 'pending'].includes(item.status) && (
                        <Button
                          className="ghost"
                          onClick={() =>
                            void retry(item).catch((err) =>
                              toast(`error.${err.code || 'request_failed'}`),
                            )
                          }
                        >
                          {t('common.retry')}
                        </Button>
                      )}
                      {item.status === 'conflict' &&
                        allowed('payments.reverse') &&
                        [
                          'payment.create',
                          'catalog.update',
                          'customer.update',
                        ].includes(item.command.action) && (
                          <Button
                            className="secondary"
                            onClick={() => void inspect(item)}
                          >
                            {t('sync.review')}
                          </Button>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {review && (
        <Modal title="sync.review" onClose={() => setReview(undefined)}>
          <p>{t('error.version_conflict')}</p>
          <dl>
            <div>
              <dt>{t('field.code')}</dt>
              <dd className="code">{review.latest.code}</dd>
            </div>
            {review.latest.totalMinor !== undefined && (
              <>
                <div>
                  <dt>{t('field.total')}</dt>
                  <dd>{fmt.money(review.latest.totalMinor)}</dd>
                </div>
                <div>
                  <dt>{t('field.paid')}</dt>
                  <dd>{fmt.money(review.latest.paidMinor || 0)}</dd>
                </div>
                <div>
                  <dt>{t('field.amount')}</dt>
                  <dd>
                    {String(
                      (review.item.command.data as Record<string, unknown>)
                        .amount || '',
                    )}
                  </dd>
                </div>
              </>
            )}
          </dl>
          {resolve.error && <ErrorState error={resolve.error} />}
          <div className="form-actions">
            <Button className="ghost" onClick={() => setReview(undefined)}>
              {t('common.cancel')}
            </Button>
            <Button
              disabled={resolve.isPending}
              onClick={() => resolve.mutate()}
            >
              {t('sync.reconcile')}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
