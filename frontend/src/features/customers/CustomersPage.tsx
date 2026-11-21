import { ListOrder, useListOrder } from '../../components/common/ListOrder';
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { allowed } from '../../services/api';
import type { Customer, Page } from '../../types/business';
import {
  Button,
  useData,
  useDebounced,
  useFormat,
  Loading,
  ErrorState,
  Empty,
  Pagination,
  Status,
} from '../../components/common/ui';
import { DateRange } from '../../components/forms/JalaliPicker';
import CustomerForm from './CustomerForm';
import { InvoicePrintButton } from '../../components/printing/InvoicePrintButton';
import { ListPrintButton } from '../../components/printing/ListPrintButton';
export default function CustomersPage() {
  const { t } = useTranslation();
  const printTarget = useRef<HTMLElement>(null);
  const fmt = useFormat();
  const navigate = useNavigate();
  const [q, setQ] = useState(''),
    [page, setPage] = useState(1),
    [type, setType] = useState(''),
    [status, setStatus] = useState(''),
    [outstanding, setOutstanding] = useState(false),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [open, setOpen] = useState(new URLSearchParams(location.search).has('new'));
  const orderFields = ['createdAt', 'fullName', 'updatedAt'];
  const [order, setOrder] = useListOrder('customers', orderFields);
  const search = useDebounced(q);
  const params = new URLSearchParams({
    q: search,
    ...order,
    page: String(page),
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
    ...(outstanding ? { outstanding: 'true' } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  });
  const query = useData<Page<Customer>>(`/customers?${params}`);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t('customer.profile')}</p>
          <h1>{t('nav.customers')}</h1>
        </div>
        <div className="row-actions">
          <ListPrintButton
            target={printTarget}
            title="nav.customers"
            ready={
              !!query.data?.items.length && !query.isFetching && !query.error
            }
            page={page}
            total={query.data?.total ?? 0}
          />
          {allowed('customers.write') && (
            <Button onClick={() => setOpen(true)}>
              <Plus size={17} />
              {t('action.newCustomer')}
            </Button>
          )}
        </div>
      </div>
      <section className="customer-filters print-exclude">
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
            <option value="purchase">{t('status.purchase')}</option>
            <option value="rental">{t('status.rental')}</option>
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
                <option key={value} value={value}>
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
            setOrder({ sort: 'createdAt', direction: 'desc' });
          }}
        />
        <DateRange
          hideClear
          from={from}
          to={to}
          onChange={(start, end) => {
            setFrom(start);
            setTo(end);
            setPage(1);
          }}
        />
      </section>
      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : !query.data?.items.length ? (
        <Empty />
      ) : (
        <section className="panel" ref={printTarget}>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {allowed('invoices.read') && (
                    <th className="print-exclude">{t('action.print')}</th>
                  )}
                  {[
                    'code',
                    'fullName',
                    'whatsapp',
                    'telephone',
                    'product',
                    'type',
                    'orderAt',
                    'reservationAt',
                    'daysRemaining',
                    'total',
                    'paid',
                    'balance',
                    'delivery',
                  ].map((field) => (
                    <th key={field}>{t(`field.${field}`)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((customer) => {
                  const txn = customer.latestTransaction;
                  return (
                    <tr
                      key={customer._id}
                      tabIndex={0}
                      className="customer-account-row"
                      onClick={(event) => {
                        if (
                          !(event.target as HTMLElement).closest(
                            'a,button,input,select,textarea',
                          )
                        )
                          navigate(`/customers/${customer._id}`);
                      }}
                      onKeyDown={(event) => {
                        if (
                          event.target === event.currentTarget &&
                          (event.key === 'Enter' || event.key === ' ')
                        ) {
                          event.preventDefault();
                          navigate(`/customers/${customer._id}`);
                        }
                      }}
                    >
                      {allowed('invoices.read') && (
                        <td className="print-exclude">
                          {txn ? <InvoicePrintButton transaction={txn} /> : '?'}
                        </td>
                      )}
                      <td className="code">{customer.code}</td>
                      <td>
                        <Link to={`/customers/${customer._id}`}>
                          <strong>{customer.fullName}</strong>
                        </Link>
                      </td>
                      <td dir="ltr">{customer.whatsapp}</td>
                      <td dir="ltr">{customer.telephone}</td>
                      <td>{txn?.product.name || '—'}</td>
                      <td>{txn ? <Status value={txn.type} /> : '—'}</td>
                      <td>{fmt.date(txn?.orderAt || customer.createdAt)}</td>
                      <td>{fmt.date(txn?.reservationAt)}</td>
                      <td>
                        {txn
                          ? Math.floor(
                              (Date.parse(txn.reservationAt) + 16200000) /
                                86400000,
                            ) - Math.floor((Date.now() + 16200000) / 86400000)
                          : '—'}
                      </td>
                      {(['total', 'paid', 'balance'] as const).map((field) => (
                        <td dir="ltr" key={field}>
                          {(customer.balances || []).map((account) => (
                            <div key={account.currency}>
                              {fmt.money(
                                field === 'total'
                                  ? account.totalMinor
                                  : field === 'paid'
                                    ? account.paidMinor
                                    : (
                                        BigInt(account.totalMinor) -
                                        BigInt(account.paidMinor)
                                      ).toString(),
                                account.currency,
                              )}
                            </div>
                          ))}
                        </td>
                      ))}
                      <td>{txn ? <Status value={txn.status} /> : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination data={query.data} onPage={setPage} />
        </section>
      )}
      {open && (
        <CustomerForm
          onClose={() => setOpen(false)}
          onSaved={(customer) => navigate(`/customers/${customer._id}?new=1`)}
        />
      )}
    </>
  );
}
