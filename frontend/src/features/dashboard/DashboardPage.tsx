import { CurrencySelect } from '../../components/forms/CurrencySelect';
import { branchCurrency } from '@myt/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Users, Activity, Building2 } from 'lucide-react';
import type { Report } from '../../types/business';
import {
  useData,
  useFormat,
  Loading,
  ErrorState,
  Empty,
  Status,
  Button,
} from '../../components/common/ui';
import {
  allowed,
  request,
  branch,
  session,
  selectBranch,
} from '../../services/api';
import TransactionTable from '../transactions/TransactionTable';
import { branchLabel } from '../../lib/branchLabel';
import {
  Welcome,
  QuickActions,
  MetricCards,
  DashboardCharts,
  DashboardNotifications,
  DeliveryBadge,
} from './DashboardWidgets';

function BranchDashboard() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const [currency, setCurrency] = useState(branchCurrency(branch()));
  const query = useData<Report>(`/dashboard?currency=${currency}`, true, 30000);
  return (
    <>
      <Welcome
        title={
          session()?.role === 'manager'
            ? 'auth.managerDashboard'
            : 'nav.dashboard'
        }
      />
      <QuickActions />
      <CurrencySelect
        value={currency}
        onChange={(e) => setCurrency(e.target.value as typeof currency)}
      />
      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : query.data ? (
        <>
          <section className="panel">
            <h2>{t('field.total')}</h2>
            <strong>
              {fmt.money(query.data.totals.agreedMinor, query.data.currency)}
            </strong>
          </section>
          <MetricCards data={query.data} />
          <DashboardCharts data={query.data} />
          <div className="dashboard-columns">
            <section className="panel">
              <div className="section-heading">
                <h2>{t('dashboard.deliveries')}</h2>
                {allowed('transactions.read.own') && (
                  <Link to="/transactions">
                    {t('common.view')} <ArrowUpRight size={14} />
                  </Link>
                )}
              </div>
              {!query.data.deliveries.length ? (
                <Empty />
              ) : (
                <div className="delivery-list">
                  {query.data.deliveries.map((row) => (
                    <Link key={row._id} to={`/transactions/${row._id}`}>
                      <div>
                        <strong>{row.customerName}</strong>
                        <small>{row.product?.name}</small>
                      </div>
                      <div>
                        <span>{fmt.date(row.reservationAt)}</span>
                        <DeliveryBadge date={row.reservationAt} />
                        <Status value={row.status} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
            <section className="panel">
              <div className="section-heading">
                <h2>{t('dashboard.activities')}</h2>
                <span className="section-icon">
                  <Activity size={19} />
                </span>
              </div>
              {!query.data.activities.length ? (
                <Empty />
              ) : (
                <ol className="activity-list">
                  {query.data.activities.map((item) => (
                    <li key={item._id}>
                      <span className="activity-dot" />
                      <div>
                        <strong>
                          {t(`actionCode.${item.action}`, {
                            defaultValue: t(`nav.${item.resource}`, {
                              defaultValue: t('common.saved'),
                            }),
                          })}
                        </strong>
                        <small>{fmt.date(item.createdAt)}</small>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
          <div className="dashboard-columns">
            <section className="panel">
              <div className="section-heading">
                <h2>{t('dashboard.recentCustomers')}</h2>
                <Users size={19} />
              </div>
              {!query.data.recentCustomers.length ? (
                <Empty />
              ) : (
                <div className="customer-activity-list">
                  {query.data.recentCustomers.map((customer) => (
                    <Link to={`/customers/${customer._id}`} key={customer._id}>
                      <span className="customer-initial">
                        {customer.fullName.slice(0, 1)}
                      </span>
                      <span>
                        <strong>{customer.fullName}</strong>
                        <small>{fmt.date(customer.createdAt)}</small>
                      </span>
                      <ArrowUpRight size={16} />
                    </Link>
                  ))}
                </div>
              )}
            </section>
            <DashboardNotifications />
          </div>
          {allowed('transactions.read.own') && (
            <section className="panel">
              <div className="section-heading">
                <h2>{t('dashboard.recent')}</h2>
                <Link to="/transactions">{t('common.view')}</Link>
              </div>
              <div className="table-scroll">
                <TransactionTable items={query.data.recent} />
              </div>
            </section>
          )}
        </>
      ) : null}
    </>
  );
}

function EmployeeDashboard() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const data = useData<Report>('/dashboard', true, 30000);
  return (
    <>
      <Welcome title="auth.employeeDashboard" />
      <QuickActions employee />
      {data.isLoading ? (
        <Loading />
      ) : data.error ? (
        <ErrorState error={data.error} retry={() => void data.refetch()} />
      ) : data.data ? (
        <>
          {allowed('transactions.read.own') && (
            <section className="panel">
              <div className="section-heading">
                <h2>{t('dashboard.recent')}</h2>
                <Link to="/transactions">{t('common.view')}</Link>
              </div>
              <div className="table-scroll">
                <TransactionTable items={data.data.recent} />
              </div>
            </section>
          )}
          <div className="dashboard-columns">
            <section className="panel">
              <div className="section-heading">
                <h2>{t('dashboard.deliveries')}</h2>
              </div>
              {!data.data.deliveries.length ? (
                <Empty />
              ) : (
                <div className="delivery-list">
                  {data.data.deliveries.map((row) => (
                    <Link key={row._id} to={'/transactions/' + row._id}>
                      <div>
                        <strong>{row.customerName}</strong>
                        <small>{fmt.date(row.reservationAt)}</small>
                      </div>
                      <DeliveryBadge date={row.reservationAt} />
                    </Link>
                  ))}
                </div>
              )}
            </section>
            <DashboardNotifications />
          </div>
        </>
      ) : null}
    </>
  );
}

function summarize(rows: (Report & { branchId: string })[]): Report {
  const days = new Map<string, { amountMinor: bigint; count: number }>();
  for (const row of rows)
    for (const day of row.byDay) {
      const previous = days.get(day._id) || { amountMinor: 0n, count: 0 };
      days.set(day._id, {
        amountMinor: previous.amountMinor + BigInt(day.amountMinor),
        count: previous.count + day.count,
      });
    }
  const sum = (fn: (row: Report) => number) =>
    rows.reduce((n, row) => n + fn(row), 0);
  const money = (fn: (row: Report) => string | number) =>
    rows.reduce((n, row) => n + BigInt(fn(row)), 0n).toString();
  return {
    customers: sum((r) => r.customers),
    products: sum((r) => r.products),
    newCustomers: sum((r) => r.newCustomers),
    upcomingCount: sum((r) => r.upcomingCount),
    overdueCount: sum((r) => r.overdueCount),
    collectedMinor: money((r) => r.collectedMinor),
    totals: {
      count: sum((r) => r.totals.count),
      purchases: sum((r) => r.totals.purchases),
      rentals: sum((r) => r.totals.rentals),
      agreedMinor: money((r) => r.totals.agreedMinor),
      paidMinor: money((r) => r.totals.paidMinor),
      outstandingMinor: money((r) => r.totals.outstandingMinor),
    },
    byDay: [...days]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([_id, day]) => ({
        _id,
        amountMinor: day.amountMinor.toString(),
        count: day.count,
      })),
    recent: [],
    deliveries: [],
    activities: [],
    recentCustomers: [],
    popularity: [],
  };
}
function CompanyDashboard() {
  const { t } = useTranslation(),
    fmt = useFormat();
  const branchNames = useQuery({
    queryKey: ['branch-names'],
    queryFn: () => request<{ _id: string; name: string }[]>('/branches'),
  });
  const name = (id: string) =>
    branchLabel(id, branchNames.data?.find((b) => b._id === id)?.name);
  const [scope, setScope] = useState('all');
  const [scopeError, setScopeError] = useState<unknown>();
  const query = useQuery({
    queryKey: ['company-dashboard'],
    queryFn: () =>
      request<(Report & { branchId: string })[]>('/dashboard/comparison'),
    refetchInterval: 30000,
  });
  async function changeScope(value: string) {
    try {
      if (value !== 'all') {
        await selectBranch(value);
        localStorage.setItem('myt-branch', value);
      }
      setScope(value);
      if (value !== 'all')
        window.dispatchEvent(new Event('myt-identity-changed'));
      setScopeError(undefined);
    } catch (error) {
      setScopeError(error);
    }
  }
  return (
    <>
      <div className="company-scope">
        <label htmlFor="company-scope">{t('premium.dashboardScope')}</label>
        <select
          id="company-scope"
          aria-label={t('auth.adminDashboard')}
          value={scope === 'all' ? 'all' : branch()}
          onChange={(e) => void changeScope(e.target.value)}
        >
          <option value="all">{t('auth.allBranches')}</option>
          {session()!.branchIds.map((id) => (
            <option key={id} value={id}>
              {name(id)}
            </option>
          ))}
        </select>
      </div>
      {scopeError !== undefined && <ErrorState error={scopeError} />}
      {scope !== 'all' ? (
        <>
          <div className="section-heading">
            <h1>{name(branch())}</h1>
            <Button
              className="secondary"
              onClick={() => void changeScope('all')}
            >
              {t('auth.allBranches')}
            </Button>
          </div>
          <BranchDashboard />
        </>
      ) : (
        <>
          <Welcome title="auth.adminDashboard" company />
          <QuickActions />
          {query.isLoading ? (
            <Loading />
          ) : query.error ? (
            <ErrorState
              error={query.error}
              retry={() => void query.refetch()}
            />
          ) : query.data ? (
            <>
              <section className="panel">
                <div className="section-heading">
                  <h2>{t('dashboard.comparison')}</h2>
                  <span className="muted">{t('auth.allBranches')}</span>
                </div>
                <div className="branch-comparison">
                  {query.data.map((row) => (
                    <article key={row.branchId}>
                      <span className="branch-card-icon">
                        <Building2 size={22} />
                      </span>
                      <h3>{name(row.branchId)}</h3>
                      <p>
                        {t('dashboard.customers')}
                        <strong>{row.customers}</strong>
                      </p>
                      <p>
                        {t('field.total')}
                        <strong>
                          {(row.currencyReports || [row]).map((account) => (
                            <span
                              key={account.currency}
                              style={{ display: 'block' }}
                            >
                              {fmt.money(
                                account.totals.agreedMinor,
                                account.currency,
                              )}
                            </span>
                          ))}
                        </strong>
                      </p>
                      <p>
                        {t('dashboard.collected')}
                        <strong>
                          {(row.currencyReports || [row]).map((account) => (
                            <span
                              key={account.currency}
                              style={{ display: 'block' }}
                            >
                              {fmt.money(
                                account.collectedMinor,
                                account.currency,
                              )}
                            </span>
                          ))}
                        </strong>
                      </p>
                      <p>
                        {t('dashboard.outstanding')}
                        <strong>
                          {(row.currencyReports || [row]).map((account) => (
                            <span
                              key={account.currency}
                              style={{ display: 'block' }}
                            >
                              {fmt.money(
                                account.totals.outstandingMinor,
                                account.currency,
                              )}
                            </span>
                          ))}
                        </strong>
                      </p>
                      <p>
                        {t('dashboard.upcomingCount')}
                        <strong>{row.upcomingCount}</strong>
                      </p>
                      <p>
                        {t('dashboard.overdueCount')}
                        <strong>{row.overdueCount}</strong>
                      </p>
                      <Button
                        className="secondary"
                        onClick={() => void changeScope(row.branchId)}
                      >
                        {t('common.view')}
                        <ArrowUpRight size={15} />
                      </Button>
                    </article>
                  ))}
                </div>
              </section>
              {(['AFN', 'USD'] as const).map((currency) => (
                <section key={currency}>
                  <h2>{currency}</h2>
                  <MetricCards
                    data={summarize(
                      query.data.flatMap((row) =>
                        (row.currencyReports || [row])
                          .filter((account) => account.currency === currency)
                          .map((account) => ({
                            ...account,
                            branchId: row.branchId,
                          })),
                      ),
                    )}
                    currency={currency}
                  />
                  <DashboardCharts
                    data={summarize(
                      query.data.flatMap((row) =>
                        (row.currencyReports || [row])
                          .filter((account) => account.currency === currency)
                          .map((account) => ({
                            ...account,
                            branchId: row.branchId,
                          })),
                      ),
                    )}
                    currency={currency}
                  />
                </section>
              ))}
              {query.data.map((row) => (
                <section className="panel company-recent" key={row.branchId}>
                  <div className="section-heading">
                    <h2>{name(row.branchId)}</h2>
                    <span className="muted">{t('dashboard.recent')}</span>
                  </div>
                  {!row.recent.length ? (
                    <Empty />
                  ) : (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>{t('nav.transactions')}</th>
                            <th>{t('field.customer')}</th>
                            <th>{t('field.total')}</th>
                            <th>{t('premium.date')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {row.recent.map((item) => (
                            <tr key={item._id}>
                              <td>
                                <span className="code">{item.code}</span>
                              </td>
                              <td>{item.customerName}</td>
                              <td>
                                {fmt.money(item.totalMinor, item.currency)}
                              </td>
                              <td>{fmt.date(item.reservationAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="section-heading">
                    <h2>{t('dashboard.activities')}</h2>
                  </div>
                  {!row.activities.length ? (
                    <Empty />
                  ) : (
                    <ol className="activity-list">
                      {row.activities.slice(0, 4).map((item) => (
                        <li key={item._id}>
                          <span className="activity-dot" />
                          <div>
                            <strong>
                              {t('actionCode.' + item.action, {
                                defaultValue: t('common.saved'),
                              })}
                            </strong>
                            <small>{fmt.date(item.createdAt)}</small>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              ))}
            </>
          ) : null}
        </>
      )}
    </>
  );
}

export default function DashboardPage() {
  return session()?.role === 'admin' ? (
    <CompanyDashboard />
  ) : session()?.role === 'manager' ? (
    <BranchDashboard />
  ) : (
    <EmployeeDashboard />
  );
}
