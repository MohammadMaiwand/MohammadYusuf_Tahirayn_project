import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { branchLabel } from '../../lib/branchLabel';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  Building2,
  Printer,
  FileSpreadsheet,
  TrendingUp,
  Users,
  Package,
  Wallet,
  AlertTriangle,
} from 'lucide-react';
import type { CompanyReport } from '../../types/business';
import {
  Button,
  useFormat,
  Loading,
  ErrorState,
  Empty,
  Status,
} from '../../components/common/ui';
import { DateRange } from '../../components/forms/JalaliPicker';
import { allowed, ApiError, request } from '../../services/api';
import { env } from '../../lib/env';

const CURRENCIES = ['AFN', 'USD'] as const;

// A4 landscape is only requested while the company report is being printed, so
// invoices and other portrait documents keep their original page geometry.
function printLandscape() {
  const style = document.createElement('style');
  style.textContent = '@page { size: A4 landscape; margin: 8mm; }';
  document.head.appendChild(style);
  const cleanup = () => {
    style.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
  window.setTimeout(cleanup, 60000);
}

function share(minor: string, total: string) {
  const whole = BigInt(total);
  if (whole === 0n) return 0;
  return Number((BigInt(minor) * 10000n) / whole) / 100;
}

export function CompanyReportView() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [exporting, setExporting] = useState<'csv' | 'excel'>();
  const [error, setError] = useState<unknown>();
  const params = new URLSearchParams({
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  });
  const query = useQuery({
    queryKey: ['company-report', params.toString()],
    queryFn: () => request<CompanyReport>(`/reports/company?${params}`),
  });
  async function download(format: 'csv' | 'excel') {
    if (exporting) return;
    setExporting(format);
    setError(undefined);
    try {
      const token = await window.mytIdentity?.accessToken();
      const headers = new Headers();
      if (token) headers.set('authorization', `Bearer ${token}`);
      const response = await fetch(
        `${env.VITE_API_URL}/reports/company/export?${params}&format=${format}`,
        { headers, credentials: 'include', signal: AbortSignal.timeout(20000) },
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
      link.download = `company-report.${format === 'csv' ? 'csv' : 'xml'}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err);
    } finally {
      setExporting(undefined);
    }
  }
  return (
    <>
      <div className="report-screen-only company-report-controls">
        <DateRange
          from={from}
          to={to}
          onChange={(a, b) => {
            setFrom(a);
            setTo(b);
          }}
        />
        {allowed('exports.read') && (
          <div className="row-actions">
            <Button
              className="secondary"
              loading={exporting === 'csv'}
              disabled={!!exporting}
              onClick={() => void download('csv')}
            >
              <FileSpreadsheet size={16} />
              {t('action.exportCSV')}
            </Button>
            <Button
              className="secondary"
              loading={exporting === 'excel'}
              disabled={!!exporting}
              onClick={() => void download('excel')}
            >
              <FileSpreadsheet size={16} />
              {t('action.exportExcel')}
            </Button>
            <Button onClick={printLandscape}>
              <Printer size={16} />
              {t('action.exportPDF')}
            </Button>
          </div>
        )}
      </div>
      <div className="report-print-only company-report-print-head">
        <h1>{t('app.company')}</h1>
        <h2>{t('nav.company-report')}</h2>
        <p>
          {fmt.date(from)} — {fmt.date(to || new Date().toISOString())}
        </p>
        {query.data && (
          <p>
            {t('companyReport.generated')}: {fmt.date(query.data.generatedAt)}
          </p>
        )}
      </div>
      {error !== undefined && <ErrorState error={error} />}
      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : query.data ? (
        !query.data.branches.length ? (
          <Empty />
        ) : (
          <div className="company-report">
            <p className="company-report-intro report-screen-only">
              {t('companyReport.subtitle')}
            </p>
            {CURRENCIES.map((currency) => {
              const account = query.data!.summary.find(
                (row) => row.currency === currency,
              );
              const rows = query.data!.comparison.filter(
                (row) => row.currency === currency,
              );
              if (!account || !rows.length) return null;
              const ranked = [...rows].sort((a, b) =>
                Number(BigInt(b.collectedMinor) - BigInt(a.collectedMinor)),
              );
              const best = ranked[0];
              return (
                <section
                  className="panel company-report-currency"
                  key={currency}
                >
                  <div className="section-heading">
                    <h2>
                      <Building2 size={18} /> {t('companyReport.summary')} ·{' '}
                      {currency}
                    </h2>
                    {best && (
                      <span className="muted">
                        <TrendingUp size={15} /> {t('companyReport.bestBranch')}
                        : {branchLabel(best.branchId, best.branchName)}
                      </span>
                    )}
                  </div>
                  <div className="company-report-kpis">
                    <article className="stat">
                      <div>
                        <Users size={18} />
                        <span>{t('dashboard.customers')}</span>
                      </div>
                      <strong dir="ltr">{account.customers}</strong>
                    </article>
                    <article className="stat">
                      <div>
                        <Users size={18} />
                        <span>{t('report.newCustomers')}</span>
                      </div>
                      <strong dir="ltr">{account.newCustomers}</strong>
                    </article>
                    <article className="stat">
                      <div>
                        <Package size={18} />
                        <span>{t('dashboard.products')}</span>
                      </div>
                      <strong dir="ltr">{account.products}</strong>
                    </article>
                    <article className="stat">
                      <div>
                        <Package size={18} />
                        <span>{t('report.transactions')}</span>
                      </div>
                      <strong dir="ltr">{account.totals.count}</strong>
                    </article>
                    <article className="stat">
                      <div>
                        <Wallet size={18} />
                        <span>{t('report.agreed')}</span>
                      </div>
                      <strong dir="ltr">
                        {fmt.money(account.totals.agreedMinor, currency)}
                      </strong>
                    </article>
                    <article className="stat">
                      <div>
                        <Wallet size={18} />
                        <span>{t('dashboard.collected')}</span>
                      </div>
                      <strong dir="ltr">
                        {fmt.money(account.collectedMinor, currency)}
                      </strong>
                    </article>
                    <article className="stat">
                      <div>
                        <Wallet size={18} />
                        <span>{t('dashboard.outstanding')}</span>
                      </div>
                      <strong dir="ltr">
                        {fmt.money(account.totals.outstandingMinor, currency)}
                      </strong>
                    </article>
                    <article className="stat">
                      <div>
                        <AlertTriangle size={18} />
                        <span>{t('dashboard.overdueCount')}</span>
                      </div>
                      <strong dir="ltr">{account.overdueCount}</strong>
                    </article>
                  </div>
                  <div className="table-scroll">
                    <table className="company-report-table">
                      <thead>
                        <tr>
                          <th>{t('companyReport.branch')}</th>
                          <th>{t('dashboard.customers')}</th>
                          <th>{t('report.newCustomers')}</th>
                          <th>{t('report.transactions')}</th>
                          <th>{t('dashboard.purchases')}</th>
                          <th>{t('dashboard.rentals')}</th>
                          <th>{t('report.agreed')}</th>
                          <th>{t('dashboard.collected')}</th>
                          <th>{t('dashboard.outstanding')}</th>
                          <th>{t('dashboard.upcomingCount')}</th>
                          <th>{t('dashboard.overdueCount')}</th>
                          <th>{t('companyReport.share')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ranked.map((row) => (
                          <tr key={row.branchId}>
                            <td>{branchLabel(row.branchId, row.branchName)}</td>
                            <td>{row.customers}</td>
                            <td>{row.newCustomers}</td>
                            <td>{row.transactions}</td>
                            <td>{row.purchases}</td>
                            <td>{row.rentals}</td>
                            <td dir="ltr">
                              {fmt.money(row.agreedMinor, currency)}
                            </td>
                            <td dir="ltr">
                              {fmt.money(row.collectedMinor, currency)}
                            </td>
                            <td dir="ltr">
                              {fmt.money(row.outstandingMinor, currency)}
                            </td>
                            <td>{row.upcomingCount}</td>
                            <td>{row.overdueCount}</td>
                            <td>
                              {share(
                                row.collectedMinor,
                                account.collectedMinor,
                              ).toFixed(2)}
                              %
                            </td>
                          </tr>
                        ))}
                        <tr className="company-report-total">
                          <td>{t('companyReport.totalRow')}</td>
                          <td>{account.customers}</td>
                          <td>{account.newCustomers}</td>
                          <td>{account.totals.count}</td>
                          <td>{account.totals.purchases}</td>
                          <td>{account.totals.rentals}</td>
                          <td dir="ltr">
                            {fmt.money(account.totals.agreedMinor, currency)}
                          </td>
                          <td dir="ltr">
                            {fmt.money(account.collectedMinor, currency)}
                          </td>
                          <td dir="ltr">
                            {fmt.money(
                              account.totals.outstandingMinor,
                              currency,
                            )}
                          </td>
                          <td>{account.upcomingCount}</td>
                          <td>{account.overdueCount}</td>
                          <td>100%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="dashboard-columns company-report-grid">
                    <section className="panel">
                      <h3>{t('companyReport.trend')}</h3>
                      {!account.byDay.length ? (
                        <Empty />
                      ) : (
                        <>
                          <div className="chart report-screen-only">
                            <ResponsiveContainer width="100%" height={240}>
                              <BarChart data={account.byDay}>
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
                              {account.byDay.map((day) => (
                                <tr key={day._id}>
                                  <td>
                                    {fmt.date(`${day._id}T12:00:00+04:30`)}
                                  </td>
                                  <td dir="ltr">
                                    {fmt.money(day.amountMinor, currency)}
                                  </td>
                                  <td>{day.count}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </>
                      )}
                    </section>
                    <section className="panel">
                      <h3>{t('companyReport.statusBreakdown')}</h3>
                      {!account.status.length ? (
                        <Empty />
                      ) : (
                        <table>
                          <thead>
                            <tr>
                              <th>{t('companyReport.statusBreakdown')}</th>
                              <th>{t('report.transactions')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {account.status.map((row) => (
                              <tr key={row.status}>
                                <td>
                                  <Status value={row.status} />
                                </td>
                                <td>{row.count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      <h3>{t('companyReport.popular')}</h3>
                      {!account.popularity.length ? (
                        <Empty />
                      ) : (
                        <table>
                          <thead>
                            <tr>
                              <th>{t('companyReport.rank')}</th>
                              <th>{t('field.product')}</th>
                              <th>{t('report.transactions')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {account.popularity.map((item, index) => (
                              <tr key={item._id}>
                                <td>{index + 1}</td>
                                <td>{item.name}</td>
                                <td>{item.count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </section>
                  </div>
                </section>
              );
            })}
          </div>
        )
      ) : null}
    </>
  );
}

export default function CompanyReportPage() {
  const { t } = useTranslation();
  return (
    <>
      <div className="page-heading report-screen-only">
        <h1>{t('nav.company-report')}</h1>
        <p className="muted">{t('companyReport.subtitle')}</p>
      </div>
      <CompanyReportView />
    </>
  );
}
