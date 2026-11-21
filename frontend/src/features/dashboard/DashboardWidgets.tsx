import {
  NotificationLink,
  NotificationTitle,
} from '../../components/common/NotificationLink';
import { useEffect, useRef, useState, useId, type CSSProperties } from 'react';
import { branchCurrency } from '@myt/shared';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { branchLabel } from '../../lib/branchLabel';
import {
  Users,
  Package,
  CalendarClock,
  Wallet,
  ShoppingBag,
  Clock3,
  ArrowUpRight,
  UserPlus,
  ReceiptText,
  Bell,
  Search,
  RefreshCw,
  CircleCheck,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import type {
  Report,
  Notification,
  Page,
  Settings,
} from '../../types/business';
import {
  useFormat,
  Empty,
  ErrorState,
  Loading,
  useData,
  afghanParts,
} from '../../components/common/ui';
import { useReducedMotion } from '../../components/common/motion';
import { allowed, session, branch } from '../../services/api';

function CountValue({
  value,
  money = false,
  currency,
}: {
  value: number | string;
  money?: boolean;
  currency?: string;
}) {
  const fmt = useFormat();
  const { i18n } = useTranslation();
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(String(value));
  useEffect(() => {
    if (reduced || !ref.current) {
      setDisplay(String(value));
      return;
    }
    let frame = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      observer.disconnect();
      const start = performance.now(),
        target = BigInt(value);
      const draw = (time: number) => {
        const progress = Math.min(1, (time - start) / 650);
        setDisplay(
          (
            (target * BigInt(Math.round((1 - (1 - progress) ** 3) * 1000))) /
            1000n
          ).toString(),
        );
        if (progress < 1) frame = requestAnimationFrame(draw);
      };
      frame = requestAnimationFrame(draw);
    });
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, reduced]);
  const format = (amount: string) =>
    money
      ? fmt.money(amount, currency)
      : new Intl.NumberFormat(i18n.language).format(BigInt(amount));
  return (
    <span ref={ref} className="count-value" aria-label={format(String(value))}>
      <span aria-hidden="true">{format(display)}</span>
    </span>
  );
}

export function Welcome({
  title,
  company = false,
}: {
  title: string;
  company?: boolean;
}) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const settings = useData<Settings>(
    '/settings',
    !company && allowed('catalog.read'),
  );
  return (
    <section className="welcome-banner">
      <div className="welcome-copy">
        <p className="welcome-kicker">
          <span />
          {t('premium.welcome', { name: session()?.name })}
        </p>
        <h1>{t(title)}</h1>
        <p>{t('premium.subtitle')}</p>
        <div className="welcome-meta">
          <span>
            <Package size={14} />
            {company
              ? t('auth.allBranches')
              : branchLabel(branch(), settings.data?.branchName)}
          </span>
          <span>
            <CalendarClock size={14} />
            {fmt.date(new Date())}
          </span>
        </div>
      </div>
      <div className="welcome-emblem" aria-hidden="true">
        <span>MYT</span>
        <small>TRADING COMPANY</small>
        <CircleCheck size={22} />
      </div>
    </section>
  );
}

export function QuickActions({ employee = false }: { employee?: boolean }) {
  const { t } = useTranslation();
  const actions = [
    {
      permission: 'customers.write',
      to: '/customers?new=1',
      icon: UserPlus,
      title: 'action.newCustomer',
      detail: 'premium.customerHint',
    },
    {
      permission: 'customers.read',
      to: '/customers',
      icon: Search,
      title: 'nav.customers',
      detail: 'premium.searchHint',
    },
    {
      permission: 'transactions.read.own',
      to: '/transactions',
      icon: ReceiptText,
      title: 'nav.transactions',
      detail: 'premium.transactionHint',
    },
    {
      permission: 'catalog.read',
      to: '/products',
      icon: Package,
      title: 'nav.products',
      detail: 'premium.catalogHint',
    },
    {
      permission: 'notifications.read',
      to: '/notifications',
      icon: Bell,
      title: 'nav.notifications',
      detail: 'premium.notificationHint',
    },
    ...(employee
      ? [
          {
            permission: 'sync.use',
            to: '/sync',
            icon: RefreshCw,
            title: 'nav.sync',
            detail: 'premium.syncHint',
          },
        ]
      : []),
  ].filter((item) => allowed(item.permission));
  return (
    <section className="quick-section" aria-label={t('premium.quickActions')}>
      <div className="section-label">
        <h2>{t('premium.quickActions')}</h2>
        <span>{t('premium.everyday')}</span>
      </div>
      <div className="quick-grid">
        {actions.map((item) => (
          <Link className="quick-action" to={item.to} key={item.to}>
            <span className="quick-icon">
              <item.icon size={20} />
            </span>
            <span>
              <strong>{t(item.title)}</strong>
              <small>{t(item.detail)}</small>
            </span>
            <ArrowUpRight size={16} className="quick-arrow" />
          </Link>
        ))}
      </div>
    </section>
  );
}

export function MetricCards({
  data,
  currency = data.currency || branchCurrency(branch()),
}: {
  data: Report;
  currency?: string;
}) {
  const { t } = useTranslation();
  const metrics = [
    { key: 'customers', value: data.customers, icon: Users, tone: 'emerald' },
    {
      key: 'newCustomers',
      value: data.newCustomers,
      icon: UserPlus,
      tone: 'blue',
    },
    { key: 'products', value: data.products, icon: Package, tone: 'emerald' },
    {
      key: 'purchases',
      value: data.totals.purchases,
      icon: ShoppingBag,
      tone: 'gold',
    },
    {
      key: 'rentals',
      value: data.totals.rentals,
      icon: CalendarClock,
      tone: 'blue',
    },
    {
      key: 'upcomingCount',
      value: data.upcomingCount,
      icon: Clock3,
      tone: 'emerald',
    },
    {
      key: 'overdueCount',
      value: data.overdueCount,
      icon: Clock3,
      tone: 'red',
    },
    {
      key: 'collected',
      value: data.collectedMinor,
      icon: Wallet,
      tone: 'emerald',
      money: true,
    },
    {
      key: 'outstanding',
      value: data.totals.outstandingMinor,
      icon: ReceiptText,
      tone: 'gold',
      money: true,
    },
  ];
  return (
    <div className="stats-grid premium-stats">
      {metrics.map((item, index) => (
        <article
          className={`stat metric-${item.tone}`}
          key={item.key}
          style={{ '--order': index } as CSSProperties}
        >
          <div className="metric-label">
            <span>{t('dashboard.' + item.key)}</span>
            <span className="metric-icon">
              <item.icon size={20} />
            </span>
          </div>
          <strong>
            <CountValue
              value={item.value}
              money={item.money ?? false}
              currency={currency}
            />
          </strong>
          <small className="metric-caption">
            {item.money ? currency : t('premium.liveRecords')}
          </small>
        </article>
      ))}
    </div>
  );
}

export function DashboardCharts({
  data,
  currency = data.currency,
}: {
  data: Report;
  currency?: string;
}) {
  const { t, i18n } = useTranslation();
  const fmt = useFormat();
  const reduced = useReducedMotion();
  const gradient = useId().replaceAll(':', '');
  const days = data.byDay.map((item) => ({
    date: fmt.date(item._id + 'T00:00:00Z'),
    amount: Number(item.amountMinor) / 100,
    exact: String(item.amountMinor),
  }));
  const categories = [
    { name: t('status.purchase'), value: data.totals.purchases },
    { name: t('status.rental'), value: data.totals.rentals },
  ];
  return (
    <div className="dashboard-chart-grid">
      <section className="panel chart-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t('premium.financialOverview')}</p>
            <h2>{t('premium.paymentHistory')}</h2>
          </div>
          <span className="chart-unit">
            {currency || branchCurrency(branch())}
          </span>
        </div>
        {!days.length ? (
          <Empty />
        ) : (
          <>
            <div
              className="dashboard-chart"
              role="img"
              aria-label={t('premium.paymentHistory')}
            >
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <AreaChart
                  data={days}
                  margin={{ top: 15, right: 20, left: 0, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="var(--chart-primary)"
                        stopOpacity={0.22}
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--chart-primary)"
                        stopOpacity={0.01}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="4 6"
                    vertical={false}
                    stroke="var(--chart-grid)"
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: 'var(--muted)' }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={35}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--muted)' }}
                    axisLine={false}
                    tickLine={false}
                    width={65}
                    tickFormatter={(v: number) =>
                      Intl.NumberFormat(i18n.language, {
                        notation: 'compact',
                      }).format(v)
                    }
                  />
                  <Tooltip
                    content={({ active, payload }) =>
                      active && payload?.[0] ? (
                        <div className="chart-tooltip">
                          <small>{payload[0].payload.date}</small>
                          <strong>
                            {fmt.money(payload[0].payload.exact, currency)}
                          </strong>
                        </div>
                      ) : null
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="var(--chart-primary)"
                    strokeWidth={2.5}
                    dot={{
                      r: 4,
                      fill: 'var(--chart-primary)',
                      stroke: '#fff',
                      strokeWidth: 2,
                    }}
                    fill={`url(#${gradient})`}
                    isAnimationActive={!reduced}
                    animationDuration={650}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <details className="chart-data">
              <summary>{t('premium.viewChartData')}</summary>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>{t('premium.date')}</th>
                      <th>{t('dashboard.collected')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {days.map((day) => (
                      <tr key={day.date}>
                        <td>{day.date}</td>
                        <td>{fmt.money(day.exact, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </section>
      <section className="panel chart-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t('premium.transactionMix')}</p>
            <h2>{t('premium.purchaseAndRental')}</h2>
          </div>
          <ReceiptText size={20} />
        </div>
        {!data.totals.count ? (
          <Empty />
        ) : (
          <>
            <div className="donut-wrap">
              <div
                className="dashboard-donut"
                role="img"
                aria-label={t('premium.purchaseAndRental')}
              >
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <PieChart>
                    <Pie
                      data={categories}
                      dataKey="value"
                      innerRadius="68%"
                      outerRadius="90%"
                      paddingAngle={4}
                      stroke="none"
                      isAnimationActive={!reduced}
                      animationDuration={650}
                    >
                      {categories.map((item, index) => (
                        <Cell
                          key={item.name}
                          fill={
                            index === 0
                              ? 'var(--chart-primary)'
                              : 'var(--chart-secondary)'
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        borderColor: 'var(--border)',
                        background: 'var(--surface)',
                        color: 'var(--text)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="donut-total">
                <strong>{data.totals.count}</strong>
                <span>{t('nav.transactions')}</span>
              </div>
            </div>
            <div className="chart-legend">
              {categories.map((item, index) => (
                <div key={item.name}>
                  <span className={`legend-dot legend-${index}`} />
                  {item.name}
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export function DashboardNotifications() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const query = useData<Page<Notification>>(
    '/notifications?limit=4',
    allowed('notifications.read'),
    30000,
  );
  if (!allowed('notifications.read')) return null;
  return (
    <section className="panel dashboard-notifications">
      <div className="section-heading">
        <h2>{t('nav.notifications')}</h2>
        <Link to="/notifications">{t('common.view')}</Link>
      </div>
      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : !query.data?.items.length ? (
        <Empty />
      ) : (
        <div className="notification-list">
          {query.data.items.map((item) => (
            <article key={item._id}>
              <span className="notification-dot" />
              <div>
                <NotificationLink record={item}>
                  <NotificationTitle record={item} />
                </NotificationLink>
                <small>{fmt.date(item.createdAt)}</small>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function DeliveryBadge({ date }: { date: string }) {
  const { t } = useTranslation();
  const dayKey = (value: Date) => {
    const p = afghanParts(value);
    return p.year * 400 + p.month * 32 + p.day;
  };
  const today = dayKey(new Date()),
    target = dayKey(new Date(date));
  const kind =
    target < today
      ? 'overdue'
      : target === today
        ? 'today'
        : target === dayKey(new Date(Date.now() + 86400000))
          ? 'tomorrow'
          : 'upcoming';
  return (
    <span className={`badge delivery-${kind}`}>{t('premium.' + kind)}</span>
  );
}
