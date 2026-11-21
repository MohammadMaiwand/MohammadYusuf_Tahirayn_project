import { CurrencySelect } from '../../components/forms/CurrencySelect';
import { branchCurrency } from '@myt/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import type { Report, Page, Transaction } from '../../types/business';
import {
  Button,
  useData,
  useFormat,
  Loading,
  ErrorState,
  Empty,
  Pagination,
} from '../../components/common/ui';
import { DateRange } from '../../components/forms/JalaliPicker';
import { allowed, branch, session, ApiError } from '../../services/api';
import { env } from '../../lib/env';
import TransactionTable from '../transactions/TransactionTable';
import { CompanyReportView } from './CompanyReport';
export default function ReportsPage() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const [currency, setCurrency] = useState(branchCurrency(branch()));
  const [scope, setScope] = useState<'branch' | 'company'>('branch');
  const isAdmin = session()?.role === 'admin';
  const [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [page, setPage] = useState(1),
    [error, setError] = useState<unknown>();
  const params = new URLSearchParams({
    currency,
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  });
  const query = useData<Report>(`/reports?${params}`);
  const transactions = useData<Page<Transaction>>(
    `/transactions?${params}&page=${page}`,
  );
  const [exporting, setExporting] = useState<'csv' | 'excel'>();
  async function download(format: 'csv' | 'excel') {
    if (exporting) return;
    setExporting(format);
    setError(undefined);
    try {
      const token = await window.mytIdentity?.accessToken();
      const headers = new Headers();
      if (token) headers.set('authorization', `Bearer ${token}`);
      const response = await fetch(
        `${env.VITE_API_URL}/branches/${branch()}/reports/export?${params}&format=${format}`,
        { headers, credentials: 'include', signal: AbortSignal.timeout(15000) },
      );
      if (!response.ok) {
        const body = await response.json();
        throw new ApiError(
          response.status,
          body.error?.message || 'request_failed',
        );
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `transactions.${format === 'csv' ? 'csv' : 'xml'}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err);
    } finally {
      setExporting(undefined);
    }
  }
  const scopeSelector = isAdmin ? (
    <label className="report-scope">
      <span>{t('companyReport.scope')}</span>
      <select
        value={scope}
        onChange={(e) => setScope(e.target.value as 'branch' | 'company')}
      >
        <option value="branch">{t('companyReport.branchScope')}</option>
        <option value="company">{t('auth.allBranches')}</option>
      </select>
    </label>
  ) : null;
  if (scope === 'company')
    return (
      <>
        <div className="page-heading report-screen-only">
          <h1>{t('nav.reports')}</h1>
          {scopeSelector}
        </div>
        <CompanyReportView />
      </>
    );
  return (
    <>
      <div className="page-heading report-screen-only">
        <h1>{t('nav.reports')}</h1>
        {scopeSelector}
        {allowed('exports.read') && (
          <div className="row-actions">
            <Button
              className="secondary"
              loading={exporting === 'csv'}
              disabled={!!exporting}
              onClick={() => void download('csv')}
            >
              {t('action.exportCSV')}
            </Button>
            <Button
              className="secondary"
              loading={exporting === 'excel'}
              disabled={!!exporting}
              onClick={() => void download('excel')}
            >
              {t('action.exportExcel')}
            </Button>
            <Button onClick={() => window.print()}>
              {t('action.exportPDF')}
            </Button>
          </div>
        )}
      </div>
      <div className="report-screen-only">
        <CurrencySelect
          value={currency}
          onChange={(e) => {
            setCurrency(e.target.value as typeof currency);
            setPage(1);
          }}
        />
        <DateRange
          from={from}
          to={to}
          onChange={(a, b) => {
            setFrom(a);
            setTo(b);
            setPage(1);
          }}
        />
      </div>
      <div className="report-print-only">
        <h1>{t('app.company')}</h1>
        <h2>
          {t('nav.reports')} · {t(`branch.${branch()}`)}
        </h2>
        <p>
          {fmt.date(from)} — {fmt.date(to || new Date().toISOString())}
        </p>
      </div>
      {error !== undefined && <ErrorState error={error} />}{' '}
      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        query.data && (
          <>
            <div className="stats-grid">
              {[
                ['report.newCustomers', String(query.data.newCustomers)],
                ['report.transactions', String(query.data.totals.count)],
                ...(allowed('alterations.financial') &&
                allowed('alterations.read')
                  ? [
                      [
                        'alteration.charges',
                        fmt.money(
                          query.data.alterationChargesMinor || 0,
                          currency,
                        ),
                      ],
                    ]
                  : []),
                ...(allowed('expenses.read')
                  ? [
                      [
                        'nav.expenses',
                        fmt.money(query.data.expensesMinor || 0, currency),
                      ],
                    ]
                  : []),
                [
                  'report.agreed',
                  fmt.money(query.data.totals.agreedMinor, currency),
                ],
                [
                  'dashboard.collected',
                  fmt.money(query.data.collectedMinor, currency),
                ],
                [
                  'dashboard.outstanding',
                  fmt.money(query.data.totals.outstandingMinor, currency),
                ],
              ].map(([key, value]) => (
                <article className="stat" key={key}>
                  <span>{t(key!)}</span>
                  <strong dir="ltr">{value}</strong>
                </article>
              ))}
            </div>
            <div className="dashboard-columns">
              <section className="panel">
                <h2>{t('report.paymentsByDay')}</h2>
                {!query.data.byDay.length ? (
                  <Empty />
                ) : (
                  <>
                    <div className="chart report-screen-only">
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={query.data.byDay}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="_id"
                            tickFormatter={(value) =>
                              fmt.date(`${value}T12:00:00+04:30`)
                            }
                            tick={{ fontSize: 10 }}
                          />
                          <YAxis
                            tickFormatter={(value) =>
                              fmt.money(Number(value), currency)
                            }
                            width={85}
                            tick={{ fontSize: 10 }}
                          />
                          <Tooltip
                            labelFormatter={(label) =>
                              fmt.date(`${label}T12:00:00+04:30`)
                            }
                            formatter={(value) => [
                              fmt.money(Number(value), currency),
                              t('dashboard.collected'),
                            ]}
                          />
                          <Bar
                            dataKey="amountMinor"
                            fill="#1a5f50"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <table>
                      <tbody>
                        {query.data.byDay.map((day) => (
                          <tr key={day._id}>
                            <td>{fmt.date(`${day._id}T12:00:00+04:30`)}</td>
                            <td>{fmt.money(day.amountMinor, currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </section>
              <section className="panel">
                <h2>{t('report.popularity')}</h2>
                {!query.data.popularity.length ? (
                  <Empty />
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>{t('field.product')}</th>
                        <th>{t('report.transactions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {query.data.popularity.map((item) => (
                        <tr key={item._id}>
                          <td>{item.name}</td>
                          <td>{item.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            </div>
          </>
        )
      )}
      <section className="panel">
        <h2>{t('nav.transactions')}</h2>
        {transactions.isLoading ? (
          <Loading />
        ) : transactions.error ? (
          <ErrorState error={transactions.error} />
        ) : (
          transactions.data && (
            <>
              <TransactionTable items={transactions.data.items} />
              <div className="report-screen-only">
                <CurrencySelect
                  value={currency}
                  onChange={(e) => {
                    setCurrency(e.target.value as typeof currency);
                    setPage(1);
                  }}
                />
                <Pagination data={transactions.data} onPage={setPage} />
              </div>
            </>
          )
        )}
      </section>
    </>
  );
}
