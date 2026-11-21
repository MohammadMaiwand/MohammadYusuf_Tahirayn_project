import AlterationsPage from '../alterations/AlterationsPage';
import {
  PaymentForm,
  TransactionEditor,
} from '../transactions/TransactionDetail';
import { InvoicePrintButton } from '../../components/printing/InvoicePrintButton';
import { Link } from 'react-router';
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { Customer, Transaction, Page } from '../../types/business';
import {
  Button,
  useData,
  useFormat,
  Loading,
  ErrorState,
  Pagination,
} from '../../components/common/ui';
import { allowed } from '../../services/api';
import CustomerForm from './CustomerForm';
import TransactionForm from '../transactions/TransactionForm';
import TransactionTable from '../transactions/TransactionTable';
import { ListPrintButton } from '../../components/printing/ListPrintButton';
function AccountTransaction({ transaction }: { transaction: Transaction }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const [open, setOpen] = useState(false);
  const detail = useData<Transaction>(`/transactions/${transaction._id}`, open);
  return (
    <section className="panel">
      <Button
        className="secondary"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {transaction.code} · {t('transaction.details')}
      </Button>
      {open &&
        (detail.isLoading ? (
          <Loading />
        ) : detail.error ? (
          <ErrorState error={detail.error} />
        ) : (
          detail.data && (
            <>
              <p>
                {detail.data.product.name} · {detail.data.product.brand} ·{' '}
                {detail.data.product.color}
              </p>
              {detail.data.packages.map((item) => (
                <p key={item.id}>
                  {item.name} · {item.quantity} ×{' '}
                  {fmt.money(item.priceMinor, detail.data!.currency)} ={' '}
                  {fmt.money(
                    item.quantity * item.priceMinor,
                    detail.data!.currency,
                  )}
                </p>
              ))}
              <h3>{t('transaction.paymentHistory')}</h3>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>{t('field.code')}</th>
                      <th>{t('field.paymentAt')}</th>
                      <th>{t('field.amount')}</th>
                      <th>{t('field.method')}</th>
                      <th>{t('field.reference')}</th>
                      <th>{t('field.notes')}</th>
                      <th>{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.data.payments?.map((payment) => (
                      <tr key={payment._id}>
                        <td>{payment.code}</td>
                        <td>{fmt.date(payment.paymentAt)}</td>
                        <td>
                          {fmt.money(
                            payment.amountMinor,
                            detail.data!.currency,
                          )}
                        </td>
                        <td>
                          {t('method.' + payment.method, {
                            defaultValue: payment.method,
                          })}
                        </td>
                        <td>{payment.reference}</td>
                        <td>{payment.notes}</td>
                        <td>
                          {payment.kind === 'payment' && (
                            <InvoicePrintButton
                              transaction={transaction}
                              paymentId={payment._id}
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {detail.data.invoices?.map((invoice) => (
                <p key={invoice._id}>
                  <Link to={`/print/${invoice._id}`}>
                    {invoice.code} · {fmt.date(invoice.createdAt)}
                  </Link>
                </p>
              ))}
            </>
          )
        ))}
    </section>
  );
}
export default function CustomerDetail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const printTarget = useRef<HTMLElement>(null);
  const fmt = useFormat();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [paymentTransaction, setPaymentTransaction] = useState<Transaction>();
  const [editTransaction, setEditTransaction] = useState<Transaction>();
  const [search, setSearch] = useState('');
  const [outstanding, setOutstanding] = useState(false);
  const [view, setView] = useState('transactions');
  const [edit, setEdit] = useState(false),
    [create, setCreate] = useState(params.has('new')),
    [page, setPage] = useState(1);
  const history = useData<
    Page<{ _id: string; action: string; createdAt: string; actorId: string }>
  >(`/audit-logs?customerId=${id}`, allowed('audit.read'));
  const customer = useData<Customer>(`/customers/${id}`);
  const transactions = useData<Page<Transaction>>(
    `/transactions?customerId=${id}&page=${page}&q=${encodeURIComponent(search)}&outstanding=${outstanding}`,
  );
  useEffect(() => {
    if (params.has('new')) setParams({}, { replace: true });
  }, [params, setParams]);
  if (customer.isLoading) return <Loading />;
  if (customer.error)
    return (
      <ErrorState
        error={customer.error}
        retry={() => void customer.refetch()}
      />
    );
  if (!customer.data) return null;
  const record = customer.data;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t('customer.profile')}</p>
          <h1>{record.fullName}</h1>
          <p className="code muted">{record.code}</p>
        </div>
        <div className="row-actions">
          {allowed('customers.write') && (
            <Button className="secondary" onClick={() => setEdit(true)}>
              {t('common.edit')}
            </Button>
          )}
          {allowed('transactions.create') && (
            <Button onClick={() => setCreate(true)}>
              {t('action.newTransaction')}
            </Button>
          )}
        </div>
      </div>
      <div
        className="row-actions customer-tabs print-exclude"
        role="tablist"
        aria-label={t('customer.profile')}
      >
        {[
          'info',
          'transactions',
          ...(allowed('alterations.read') ? ['alterations'] : []),
        ].map((key) => (
          <Button
            key={key}
            role="tab"
            aria-selected={view === key}
            onClick={() => setView(key)}
          >
            {t(key === 'info' ? 'customer.profile' : 'nav.' + key)}
          </Button>
        ))}
      </div>
      <section className="panel profile-card">
        <dl>
          {(
            [
              'whatsapp',
              'telephone',
              'secondaryPhone',
              'address',
              'createdAt',
            ] as const
          ).map((field) => (
            <div key={field}>
              <dt>{t(`field.${field}`)}</dt>
              <dd dir={field === 'createdAt' ? undefined : 'ltr'}>
                {field === 'createdAt'
                  ? fmt.date(record[field])
                  : record[field] || '—'}
              </dd>
            </div>
          ))}
        </dl>
        {record.notes && <p>{record.notes}</p>}
      </section>
      <section className="stats-grid">
        {record.balances?.map((balance) => (
          <article className="panel" key={balance.currency}>
            <h2>{balance.currency}</h2>
            <p>
              {t('field.total')}:{' '}
              {fmt.money(balance.totalMinor, balance.currency)}
            </p>
            <p>
              {t('field.paid')}:{' '}
              {fmt.money(balance.paidMinor, balance.currency)}
            </p>
            <p>
              {t('field.balance')}:{' '}
              {fmt.money(balance.outstandingMinor, balance.currency)}
            </p>
          </article>
        ))}
      </section>
      {view === 'alterations' && allowed('alterations.read') && (
        <AlterationsPage customer={record} />
      )}
      {view === 'transactions' && (
        <>
          <div className="section-heading">
            <div>
              <h2>{t('customer.history')}</h2>
              <p className="muted">{t('customer.reuse')}</p>
            </div>
            <ListPrintButton
              target={printTarget}
              title="customer.history"
              ready={
                !!transactions.data?.items.length &&
                !transactions.isFetching &&
                !transactions.error
              }
              page={page}
              total={transactions.data?.total ?? 0}
            />
          </div>
          <div className="toolbar">
            <input
              aria-label={t('common.search')}
              placeholder={t('common.search')}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
            <label className="check">
              <input
                type="checkbox"
                checked={outstanding}
                onChange={(event) => {
                  setOutstanding(event.target.checked);
                  setPage(1);
                }}
              />
              {t('dashboard.outstanding')}
            </label>
          </div>
          <section className="panel" ref={printTarget}>
            {transactions.isLoading ? (
              <Loading />
            ) : transactions.error ? (
              <ErrorState error={transactions.error} />
            ) : (
              transactions.data && (
                <>
                  <TransactionTable items={transactions.data.items} />
                  {transactions.data.items.map((transaction) => (
                    <div className="section-heading" key={transaction._id}>
                      <Link to={`/transactions/${transaction._id}`}>
                        {transaction.code}
                      </Link>
                      <div className="row-actions">
                        {allowed('payments.create') &&
                          transaction.status !== 'cancelled' &&
                          transaction.totalMinor > transaction.paidMinor && (
                            <Button
                              onClick={() => setPaymentTransaction(transaction)}
                            >
                              {t('action.addPayment')}
                            </Button>
                          )}
                        {allowed('transactions.update') &&
                          ['pending', 'ready'].includes(transaction.status) && (
                            <Button
                              className="secondary"
                              onClick={() => setEditTransaction(transaction)}
                            >
                              {t('common.edit')}
                            </Button>
                          )}
                        <InvoicePrintButton transaction={transaction} />
                      </div>
                    </div>
                  ))}
                  {transactions.data.items.map((transaction) => (
                    <AccountTransaction
                      key={transaction._id}
                      transaction={transaction}
                    />
                  ))}
                  <Pagination data={transactions.data} onPage={setPage} />
                </>
              )
            )}
          </section>
          {allowed('audit.read') && (
            <section className="panel">
              <h2>{t('nav.audit-logs')}</h2>
              {history.isLoading ? (
                <Loading />
              ) : history.error ? (
                <ErrorState error={history.error} />
              ) : (
                <ol>
                  {history.data?.items.map((event) => (
                    <li key={event._id}>
                      {t('actionCode.' + event.action, {
                        defaultValue: event.action,
                      })}{' '}
                      · {fmt.date(event.createdAt)} · {event.actorId}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}
        </>
      )}
      {paymentTransaction && (
        <PaymentForm
          transaction={paymentTransaction}
          onClose={() => setPaymentTransaction(undefined)}
        />
      )}
      {editTransaction && (
        <TransactionEditor
          transaction={editTransaction}
          onClose={() => setEditTransaction(undefined)}
        />
      )}
      {edit && (
        <CustomerForm customer={record} onClose={() => setEdit(false)} />
      )}{' '}
      {create && (
        <TransactionForm
          customer={record}
          onClose={() => setCreate(false)}
          onSaved={(transaction) =>
            navigate(`/transactions/${transaction._id}`)
          }
        />
      )}
    </>
  );
}
