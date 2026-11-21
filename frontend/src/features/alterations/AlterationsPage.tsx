import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { alterationStatuses } from '@myt/shared';
import {
  Button,
  Loading,
  ErrorState,
  Empty,
  Field,
  Pagination,
  useDebounced,
  useFormat,
} from '../../components/common/ui';
import { DateRange } from '../../components/forms/JalaliPicker';
import { ClothingPhoto } from '../../components/common/ClothingPhoto';
import { allowed, branch, session, selectBranch } from '../../services/api';
import type {
  Alteration,
  Customer,
  Page,
  Transaction,
} from '../../types/business';
import { useAlterations } from './api';
import AlterationForm from './AlterationForm';
export default function AlterationsPage({
  customer,
  transaction,
}: {
  customer?: Customer | undefined;
  transaction?: Transaction | undefined;
}) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    q: '',
    garmentId: '',
    tailor: '',
    status: '',
    currency: '',
    customerId: '',
    startFrom: '',
    startTo: '',
    deliveryFrom: '',
    deliveryTo: '',
  });
  const q = useDebounced(filters.q),
    garmentId = useDebounced(filters.garmentId),
    tailor = useDebounced(filters.tailor);
  const params = new URLSearchParams({
    page: String(page),
    ...Object.fromEntries(
      Object.entries({
        ...filters,
        q,
        garmentId,
        tailor,
        ...(customer ? { customerId: customer._id } : {}),
        ...(transaction
          ? {
              customerId: transaction.customerId,
              transactionId: transaction._id,
            }
          : {}),
      }).filter(([, value]) => value),
    ),
  });
  const query = useAlterations<
    Page<Alteration> & { summary: Record<string, number> }
  >(`/alterations?${params}`);
  const customers = useAlterations<Page<Customer>>(
    '/customers?limit=100',
    !customer && !transaction && allowed('customers.read'),
  );
  const change = (field: keyof typeof filters, value: string) => {
    setFilters((current) => ({ ...current, [field]: value }));
    setPage(1);
  };
  const standalone = !customer && !transaction;
  return (
    <section className="alterations-module">
      <div className="page-heading">
        <div>
          {customer || transaction ? (
            <h2>{t('nav.alterations')}</h2>
          ) : (
            <h1>{t('nav.alterations')}</h1>
          )}
          <p className="muted">{t('alteration.hint')}</p>
        </div>
        {allowed('alterations.create') && allowed('alterations.financial') && (
          <Button onClick={() => setOpen(true)}>{t('alteration.new')}</Button>
        )}
      </div>
      <section className="customer-filters print-exclude">
        <div className="toolbar">
          <input
            aria-label={t('common.search')}
            placeholder={t('common.search')}
            value={filters.q}
            onChange={(e) => change('q', e.target.value)}
          />
          <input
            aria-label={t('alteration.garmentId')}
            placeholder={t('alteration.garmentId')}
            value={filters.garmentId}
            onChange={(e) => change('garmentId', e.target.value)}
          />
          <input
            aria-label={t('alteration.tailor')}
            placeholder={t('alteration.tailor')}
            value={filters.tailor}
            onChange={(e) => change('tailor', e.target.value)}
          />
          <select
            aria-label={t('field.status')}
            value={filters.status}
            onChange={(e) => change('status', e.target.value)}
          >
            <option value="">{t('common.all')}</option>
            {alterationStatuses.map((status) => (
              <option key={status} value={status}>
                {t('alteration.status.' + status)}
              </option>
            ))}
          </select>
          <select
            aria-label={t('field.currency')}
            value={filters.currency}
            onChange={(e) => change('currency', e.target.value)}
          >
            <option value="">{t('common.all')}</option>
            <option value="AFN">AFN</option>
            <option value="USD">USD</option>
          </select>
          {!customer && !transaction && (
            <select
              aria-label={t('field.customer')}
              value={filters.customerId}
              onChange={(e) => change('customerId', e.target.value)}
            >
              <option value="">{t('common.all')}</option>
              {customers.data?.items.map((row) => (
                <option key={row._id} value={row._id}>
                  {row.fullName}
                </option>
              ))}
            </select>
          )}
          <select
            aria-label={t('alteration.branch')}
            value={branch()}
            disabled={session()?.role !== 'admin'}
            onChange={(e) => {
              void selectBranch(e.target.value).then(() =>
                window.dispatchEvent(new Event('myt-identity-changed')),
              );
            }}
          >
            {session()?.branchIds.map((id) => (
              <option key={id} value={id}>
                {t('branch.' + id)}
              </option>
            ))}
          </select>
          <Button
            className="ghost"
            onClick={() => {
              setFilters({
                q: '',
                garmentId: '',
                tailor: '',
                status: '',
                currency: '',
                customerId: '',
                startFrom: '',
                startTo: '',
                deliveryFrom: '',
                deliveryTo: '',
              });
              setPage(1);
            }}
          >
            {t('design.clear')}
          </Button>
        </div>
        <details>
          <summary>{t('alteration.dateFilters')}</summary>
          <Field label="alteration.start">
            <DateRange
              from={filters.startFrom}
              to={filters.startTo}
              onChange={(from, to) => {
                setFilters((value) => ({
                  ...value,
                  startFrom: from,
                  startTo: to,
                }));
                setPage(1);
              }}
            />
          </Field>
          <Field label="alteration.expected">
            <DateRange
              from={filters.deliveryFrom}
              to={filters.deliveryTo}
              onChange={(from, to) => {
                setFilters((value) => ({
                  ...value,
                  deliveryFrom: from,
                  deliveryTo: to,
                }));
                setPage(1);
              }}
            />
          </Field>
        </details>
      </section>
      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        query.data && (
          <>
            {standalone && (
              <div className="stats-grid alteration-stats">
                {[
                  'total',
                  'pending',
                  'in_progress',
                  'ready',
                  'dueTomorrow',
                  'overdue',
                  'delivered',
                ].map((key) => (
                  <article className="stat" key={key}>
                    <span>{t('alteration.summary.' + key)}</span>
                    <strong>{query.data.summary[key] || 0}</strong>
                  </article>
                ))}
              </div>
            )}
            {!query.data.items.length ? (
              <Empty />
            ) : (
              <section className="panel">
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        {[
                          'garmentId',
                          'customerName',
                          'telephone',
                          'photo',
                          'garmentName',
                          'garmentType',
                          'brand',
                          'color',
                          'original',
                          'price',
                          'currency',
                          'tailor',
                          'start',
                          'expected',
                          'duration',
                          'status',
                          'actions',
                        ].map((key) => (
                          <th key={key}>{t('alteration.' + key)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {query.data.items.map((row) => (
                        <tr key={row._id}>
                          <td className="code">{row.garmentId}</td>
                          <td>
                            <Link to={'/customers/' + row.customerId}>
                              {row.customerName}
                            </Link>
                          </td>
                          <td dir="ltr">{row.telephone}</td>
                          <td>
                            <ClothingPhoto photoId={row.photoId} />
                          </td>
                          <td>{row.garmentName}</td>
                          <td>{row.garmentType}</td>
                          <td>{row.brand}</td>
                          <td>{row.color}</td>
                          <td dir="ltr">
                            {row.originalMinor === undefined
                              ? '-'
                              : fmt.money(
                                  row.originalMinor,
                                  row.originalCurrency || row.currency,
                                )}
                          </td>
                          <td dir="ltr">
                            {row.alterationMinor === undefined
                              ? '-'
                              : fmt.money(row.alterationMinor, row.currency)}
                          </td>
                          <td>{row.currency}</td>
                          <td>{row.tailorName}</td>
                          <td>{fmt.date(row.startAt)}</td>
                          <td>{fmt.date(row.expectedAt)}</td>
                          <td>
                            {row.durationDays} {t('alteration.days')}
                          </td>
                          <td>
                            <span className={'badge alteration-' + row.status}>
                              {t('alteration.status.' + row.status)}
                            </span>
                          </td>
                          <td>
                            <div className="row-actions">
                              <Link to={'/alterations/' + row._id}>
                                {t('common.view')}
                              </Link>
                              {allowed('alterations.print') && (
                                <Link
                                  to={'/alterations/' + row._id + '/receipt'}
                                >
                                  {t('alteration.print')}
                                </Link>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination data={query.data} onPage={setPage} />
              </section>
            )}
          </>
        )
      )}
      {open && (
        <AlterationForm
          customer={customer}
          transaction={transaction}
          onClose={() => setOpen(false)}
          onSaved={(row) => navigate('/alterations/' + row._id)}
        />
      )}
    </section>
  );
}
