import { ListOrder, useListOrder } from '../../components/common/ListOrder';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Page, Transaction } from '../../types/business';
import {
  useData,
  useDebounced,
  Loading,
  ErrorState,
  Pagination,
} from '../../components/common/ui';
import { DateRange } from '../../components/forms/JalaliPicker';
import TransactionTable from './TransactionTable';
import { ListPrintButton } from '../../components/printing/ListPrintButton';
export default function TransactionsPage() {
  const { t } = useTranslation();
  const printTarget = useRef<HTMLElement>(null);
  const [q, setQ] = useState(''),
    [page, setPage] = useState(1),
    [type, setType] = useState(''),
    [status, setStatus] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [outstanding, setOutstanding] = useState(false);
  const orderFields = [
    'createdAt',
    'reservationAt',
    'orderAt',
    'totalMinor',
    'paidMinor',
  ];
  const [order, setOrder] = useListOrder('transactions', orderFields);
  const search = useDebounced(q);
  const params = new URLSearchParams({
    q: search,
    ...order,
    page: String(page),
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(outstanding ? { outstanding: 'true' } : {}),
  });
  const query = useData<Page<Transaction>>(`/transactions?${params}`);
  return (
    <>
      <div className="page-heading">
        <h1>{t('nav.transactions')}</h1>
        <ListPrintButton
          target={printTarget}
          title="nav.transactions"
          ready={
            !!query.data?.items.length && !query.isFetching && !query.error
          }
          page={page}
          total={query.data?.total ?? 0}
        />
      </div>
      <div className="toolbar">
        <input
          aria-label={t('common.search')}
          placeholder={t('common.search')}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <select
          aria-label={t('field.type')}
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
        >
          <option value="">{t('common.all')}</option>
          {['purchase', 'rental'].map((value) => (
            <option value={value} key={value}>
              {t(`status.${value}`)}
            </option>
          ))}
        </select>
        <select
          aria-label={t('field.delivery')}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">{t('common.all')}</option>
          {['pending', 'ready', 'delivered', 'returned', 'cancelled'].map(
            (value) => (
              <option value={value} key={value}>
                {t(`status.${value}`)}
              </option>
            ),
          )}
        </select>
        <label className="check">
          <input
            type="checkbox"
            checked={outstanding}
            onChange={(e) => {
              setOutstanding(e.target.checked);
              setPage(1);
            }}
          />
          {t('dashboard.outstanding')}
        </label>
      </div>
      <ListOrder
        fields={orderFields}
        order={order}
        onChange={(value) => {
          setOrder(value);
          setPage(1);
        }}
        onClear={() => {
          setQ('');
          setType('');
          setStatus('');
          setOutstanding(false);
          setFrom('');
          setTo('');
          setPage(1);
        }}
      />
      <DateRange
        hideClear
        from={from}
        to={to}
        onChange={(a, b) => {
          setFrom(a);
          setTo(b);
          setPage(1);
        }}
      />
      <section className="panel" ref={printTarget}>
        {query.isLoading ? (
          <Loading />
        ) : query.error ? (
          <ErrorState error={query.error} retry={() => void query.refetch()} />
        ) : (
          query.data && (
            <>
              <TransactionTable items={query.data.items} />
              <Pagination data={query.data} onPage={setPage} />
            </>
          )
        )}
      </section>
    </>
  );
}
