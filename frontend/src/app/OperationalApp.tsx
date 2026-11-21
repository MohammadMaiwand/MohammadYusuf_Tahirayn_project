import {
  NotificationLink,
  NotificationTitle,
} from '../components/common/NotificationLink';
import { useQuery } from '@tanstack/react-query';
import { lazy, Suspense, useEffect, useState, useRef } from 'react';
import {
  NavLink,
  Routes,
  Route,
  Link,
  useLocation,
  Navigate,
} from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Package,
  Users,
  ArrowRightLeft,
  Bell,
  BarChart3,
  Settings,
  Shield,
  RefreshCw,
  Menu,
  Layers,
  HandCoins,
  ClipboardList,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  Search,
  CalendarDays,
  Megaphone,
  Building2,
} from 'lucide-react';
import type { Permission, SessionIdentity } from '@myt/shared';
import * as api from '../services/api';
import {
  ensureDevice,
  synchronize,
  queue,
  mutate,
} from '../offline/operations';
import { queryClient } from '../lib/queryClient';
import { branchLabel } from '../lib/branchLabel';
import { usePreferences } from '../stores/preferences';
import {
  Button,
  Loading,
  ErrorState,
  Toasts,
  useData,
  useFormat,
  Modal,
  Empty,
} from '../components/common/ui';
import { AppearanceControls } from '../components/common/Appearance';
import type { Page, Notification } from '../types/business';
const Dashboard = lazy(() => import('../features/dashboard/DashboardPage'));
const Alterations = lazy(
  () => import('../features/alterations/AlterationsPage'),
);
const AlterationDetail = lazy(
  () => import('../features/alterations/AlterationDetail'),
);
const Catalog = lazy(() => import('../features/branches/CatalogPage'));
const Expenses = lazy(() => import('../features/expenses/ExpensesPage'));
const Advertisements = lazy(
  () => import('../features/advertisements/AdvertisementsPage'),
);
const Customers = lazy(() => import('../features/customers/CustomersPage'));
const CustomerDetail = lazy(
  () => import('../features/customers/CustomerDetail'),
);
const Transactions = lazy(
  () => import('../features/transactions/TransactionsPage'),
);
const TransactionDetail = lazy(
  () => import('../features/transactions/TransactionDetail'),
);
const Reports = lazy(() => import('../features/reports/ReportsPage'));
const CompanyReportPage = lazy(
  () => import('../features/reports/CompanyReport'),
);
const Print = lazy(() => import('../features/reports/PrintPage'));
const Notifications = lazy(
  () => import('../features/messages/NotificationsPage'),
);
const BranchSettings = lazy(() => import('../features/branches/SettingsPage'));
const Staff = lazy(() => import('../features/auth/AccountsPage'));
const Audit = lazy(() => import('../features/reports/AuditPage'));
const Sync = lazy(() => import('../features/branches/SyncPage'));
const Login = lazy(() => import('../features/auth/LoginPage'));
const Sessions = lazy(() => import('../features/auth/SessionsPage'));
const Home = lazy(() => import('../features/public/HomePage'));
const navigation = [
  {
    path: '/sessions',
    key: 'sessions',
    icon: Shield,
    permission: 'dashboard.read',
  },
  {
    path: '/dashboard',
    key: 'dashboard',
    icon: LayoutDashboard,
    permission: 'dashboard.read',
  },
  {
    path: '/expenses',
    key: 'expenses',
    icon: HandCoins,
    permission: 'expenses.read',
  },
  {
    path: '/customers',
    key: 'customers',
    icon: Users,
    permission: 'customers.read',
  },
  {
    path: '/transactions',
    key: 'transactions',
    icon: ArrowRightLeft,
    permission: 'transactions.read.own',
  },
  {
    path: '/products',
    key: 'products',
    icon: Package,
    permission: 'catalog.read',
  },
  {
    path: '/alterations',
    key: 'alterations',
    icon: ClipboardList,
    permission: 'alterations.read',
  },
  {
    path: '/product-categories',
    key: 'product-categories',
    icon: Layers,
    permission: 'catalog.read',
  },
  {
    path: '/guarantees',
    key: 'guarantees',
    icon: HandCoins,
    permission: 'catalog.read',
  },
  {
    path: '/package-items',
    key: 'package-items',
    icon: ClipboardList,
    permission: 'catalog.read',
  },
  {
    path: '/notifications',
    key: 'notifications',
    icon: Bell,
    permission: 'notifications.read',
  },
  {
    path: '/reports',
    key: 'reports',
    icon: BarChart3,
    permission: 'reports.read',
  },
  {
    path: '/reports/company',
    key: 'company-report',
    icon: Building2,
    permission: 'reports.read',
  },
  {
    path: '/settings',
    key: 'settings',
    icon: Settings,
    permission: 'settings.write',
  },
  { path: '/users', key: 'users', icon: Shield, permission: 'users.manage' },
  {
    path: '/audit-logs',
    key: 'audit-logs',
    icon: ClipboardList,
    permission: 'audit.read',
  },
  { path: '/sync', key: 'sync', icon: RefreshCw, permission: 'sync.use' },
  {
    path: '/advertisements',
    key: 'advertisements',
    icon: Megaphone,
    permission: 'advertisements.manage',
  },
] as const;
const navGroups = [
  {
    key: 'design.operations',
    items: ['dashboard', 'customers', 'transactions', 'expenses'],
  },
  {
    key: 'design.inventory',
    items: [
      'products',
      'alterations',
      'product-categories',
      'guarantees',
      'package-items',
    ],
  },
  {
    key: 'design.insights',
    items: ['notifications', 'reports', 'company-report', 'audit-logs', 'sync'],
  },
  {
    key: 'workflow.management',
    items: ['users', 'advertisements', 'settings', 'sessions'],
  },
];
function AppNavigation({
  horizontal = false,
  collapsed = false,
  unread = 0,
  pending = 0,
}: {
  horizontal?: boolean;
  collapsed?: boolean;
  unread?: number;
  pending?: number;
}) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const currentGroup =
    navGroups.find((g) =>
      navigation.some(
        (n) => g.items.includes(n.key) && pathname.startsWith(n.path),
      ),
    )?.key || navGroups[0]!.key;
  const [expanded, setExpanded] = useState(horizontal ? '' : currentGroup);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    setExpanded(horizontal ? '' : currentGroup);
  }, [pathname, horizontal, currentGroup]);
  useEffect(() => {
    if (!horizontal) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setExpanded('');
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [horizontal]);
  return (
    <nav
      ref={ref}
      className={horizontal ? 'top-menubar' : 'sidebar-navigation'}
      aria-label={t(horizontal ? 'design.top' : 'design.sidebar')}
      onKeyDown={(event) => {
        const target = event.target as HTMLElement;
        const group = target.closest('details');
        const summary = group?.querySelector('summary');
        if (event.key === 'Escape') {
          setExpanded('');
          summary?.focus();
        }
        if (
          ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) &&
          group
        ) {
          event.preventDefault();
          setExpanded(group.dataset.group || '');
          const links = Array.from(
            group.querySelectorAll<HTMLAnchorElement>('a'),
          );
          const index = links.indexOf(target as HTMLAnchorElement);
          const next =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? links.length - 1
                : (index + (event.key === 'ArrowUp' ? -1 : 1) + links.length) %
                  links.length;
          requestAnimationFrame(() => links[next]?.focus());
        }
        if (
          horizontal &&
          target.tagName === 'SUMMARY' &&
          ['ArrowLeft', 'ArrowRight'].includes(event.key)
        ) {
          event.preventDefault();
          const buttons = Array.from(
            ref.current?.querySelectorAll<HTMLElement>('summary') || [],
          );
          const direction =
            (event.key === 'ArrowRight' ? 1 : -1) *
            (document.documentElement.dir === 'rtl' ? -1 : 1);
          buttons[
            (buttons.indexOf(target) + direction + buttons.length) %
              buttons.length
          ]?.focus();
        }
      }}
    >
      {navGroups.map((group) => {
        const items = navigation
          .filter(
            (n) =>
              group.items.includes(n.key) &&
              api.allowed(n.permission) &&
              (n.key !== 'company-report' || api.session()?.role === 'admin'),
          )
          .sort(
            (a, b) => group.items.indexOf(a.key) - group.items.indexOf(b.key),
          );
        if (!items.length) return null;
        return (
          <details
            key={group.key}
            data-group={group.key}
            className={`nav-group ${group.key === currentGroup ? 'current-group' : ''}`}
            open={collapsed || expanded === group.key}
          >
            <summary
              onClick={(event) => {
                event.preventDefault();
                setExpanded(expanded === group.key ? '' : group.key);
              }}
            >
              {t(group.key)}
              <ChevronDown size={14} />
            </summary>
            <div className="nav-group-items">
              {items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => {
                    if (horizontal) setExpanded('');
                  }}
                  end={item.path === '/dashboard' || item.path === '/reports'}
                  title={t(`nav.${item.key}`)}
                  aria-label={t(`nav.${item.key}`)}
                  className={({ isActive }) => (isActive ? 'active' : '')}
                >
                  <item.icon size={19} />
                  <span>{t(`nav.${item.key}`)}</span>
                  {item.key === 'notifications' && unread > 0 && (
                    <b>{unread}</b>
                  )}
                  {item.key === 'sync' && pending > 0 && <b>{pending}</b>}
                </NavLink>
              ))}
            </div>
          </details>
        );
      })}
    </nav>
  );
}
function WorkspaceFinder({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const items = navigation.filter(
    (item) =>
      api.allowed(item.permission) &&
      (item.key !== 'company-report' || api.session()?.role === 'admin') &&
      t(`nav.${item.key}`)
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
  );
  return (
    <Modal title="design.find" onClose={onClose}>
      <input
        className="finder-input"
        aria-label={t('design.find')}
        placeholder={t('design.findHint')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="finder-results">
        {items.map((item) => (
          <Link to={item.path} key={item.path} onClick={onClose}>
            <item.icon size={19} />
            <span>{t(`nav.${item.key}`)}</span>
          </Link>
        ))}
        {!items.length && <Empty />}
      </div>
    </Modal>
  );
}
function Protected({
  permission,
  adminOnly = false,
  children,
}: {
  permission: Permission;
  adminOnly?: boolean;
  children: React.ReactNode;
}) {
  return api.allowed(permission) &&
    (!adminOnly || api.session()?.role === 'admin') ? (
    children
  ) : (
    <ErrorState error={new api.ApiError(403, 'forbidden')} />
  );
}
function Workspace({ identity }: { identity: SessionIdentity }) {
  const { t, i18n } = useTranslation();
  const fmt = useFormat();
  const names = useQuery({
    queryKey: ['branch-names'],
    queryFn: () => api.request<{ _id: string; name: string }[]>('/branches'),
  });
  const branchName = (id: string) =>
    branchLabel(id, names.data?.find((b) => b._id === id)?.name);
  const location = useLocation();
  const { language, setLanguage, navigationMode } = usePreferences();
  const [finder, setFinder] = useState(false);
  const [collapsed, setCollapsed] = useState(
    localStorage.getItem('myt-sidebar-collapsed') === 'true',
  );
  const profileMenu = useRef<HTMLDetailsElement>(null);
  const notificationMenu = useRef<HTMLDetailsElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const [selectedBranch, setSelectedBranch] = useState(api.branch()),
    [mobile, setMobile] = useState(false),
    [online, setOnline] = useState(navigator.onLine),
    [pending, setPending] = useState(0),
    [error, setError] = useState<unknown>();
  const notifications = useData<Page<Notification>>(
    '/notifications?unread=true&limit=5',
    identity.role !== 'admin' && api.allowed('notifications.read'),
    30000,
  );
  const globalNotifications = useQuery({
    queryKey: ['global-unread'],
    queryFn: () =>
      api.request<Notification[]>('/notifications/global?unread=true'),
    enabled: identity.role === 'admin' && api.allowed('notifications.read'),
    refetchInterval: 30000,
  });
  const unreadCount =
    identity.role === 'admin'
      ? globalNotifications.data?.length || 0
      : notifications.data?.total || 0;
  useEffect(() => {
    void i18n.changeLanguage(language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'en' ? 'ltr' : 'rtl';
  }, [language, i18n]);
  useEffect(() => {
    setMobile(false);
    if (profileMenu.current) profileMenu.current.open = false;
    if (notificationMenu.current) notificationMenu.current.open = false;
  }, [location.pathname, navigationMode]);
  useEffect(() => {
    const dismiss = (event: MouseEvent) => {
      if (
        notificationMenu.current &&
        !notificationMenu.current.contains(event.target as Node)
      )
        notificationMenu.current.open = false;
      if (
        profileMenu.current &&
        !profileMenu.current.contains(event.target as Node)
      )
        profileMenu.current.open = false;
    };
    document.addEventListener('click', dismiss);
    return () => document.removeEventListener('click', dismiss);
  }, []);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 800px)');
    const update = () => {
      if (sidebar.current)
        sidebar.current.inert = query.matches
          ? !mobile
          : navigationMode === 'top';
    };
    update();
    query.addEventListener('change', update);
    if (mobile)
      Array.from(
        sidebar.current?.querySelectorAll<HTMLElement>('a,button,summary') ||
          [],
      )
        .find((item) => item.getClientRects().length > 0)
        ?.focus();
    return () => query.removeEventListener('change', update);
  }, [mobile, navigationMode]);
  useEffect(() => {
    if (!mobile) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobile]);
  useEffect(() => {
    const load = () => {
      void queue()
        .then((items) =>
          setPending(
            items.filter(
              (item) => !['synced', 'superseded'].includes(item.status),
            ).length,
          ),
        )
        .catch(() => {});
    };
    const connected = () => {
      setOnline(true);
      void ensureDevice()
        .then(synchronize)
        .catch(() => {});
    };
    const disconnected = () => setOnline(false);
    const network = (event: Event) =>
      setOnline((event as CustomEvent<boolean>).detail);
    load();
    window.addEventListener('online', connected);
    window.addEventListener('offline', disconnected);
    window.addEventListener('myt-network', network);
    window.addEventListener('myt-sync-changed', load);
    const timer = setInterval(() => {
      void synchronize();
    }, 30000);
    void ensureDevice()
      .then(synchronize)
      .catch(() => {});
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', connected);
      window.removeEventListener('offline', disconnected);
      window.removeEventListener('myt-network', network);
      window.removeEventListener('myt-sync-changed', load);
    };
  }, [selectedBranch]);
  useEffect(() => {
    const find = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setFinder((value) => !value);
      }
    };
    document.addEventListener('keydown', find);
    return () => document.removeEventListener('keydown', find);
  }, []);
  async function changeBranch(value: string) {
    try {
      await api.selectBranch(value);
      localStorage.setItem('myt-branch', value);
      queryClient.clear();
      setSelectedBranch(value);
      setError(undefined);
    } catch (err) {
      setError(err);
    }
  }
  function changeLanguage(value: typeof language) {
    setLanguage(value);
    if (navigator.onLine)
      void mutate('preferences.update', { language: value }).catch(() => {});
  }
  const active =
    navigation.find(
      (item) =>
        item.path !== '/dashboard' && location.pathname.startsWith(item.path),
    ) || navigation.find((item) => item.path === '/dashboard')!;
  return (
    <div
      className={`app-frame navigation-${navigationMode} ${collapsed ? 'sidebar-collapsed' : ''}`}
    >
      <aside
        id="application-sidebar"
        ref={sidebar}
        className={`app-sidebar ${mobile ? 'open' : ''}`}
        onClick={(event) => {
          if (mobile && (event.target as HTMLElement).closest('a'))
            setMobile(false);
        }}
        onKeyDown={(event) => {
          if (!mobile) return;
          if (event.key === 'Escape') {
            setMobile(false);
            menuButton.current?.focus();
          }
          if (event.key === 'Tab') {
            const items = Array.from(
              sidebar.current?.querySelectorAll<HTMLElement>(
                'a,button,summary',
              ) || [],
            ).filter((item) => item.getClientRects().length > 0);
            const first = items?.[0],
              last = items?.[items.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <Link to="/" className="brand">
          <span className="brand-icon">
            <span className="myt-wordmark" aria-hidden="true">
              MYT
            </span>
          </span>
          <span className="brand-copy">
            <strong>{t('app.name')}</strong>
            <small>{t('app.company')}</small>
          </span>
        </Link>
        <p className="nav-section-label">{t('premium.workspace')}</p>
        <AppNavigation
          collapsed={collapsed && !mobile}
          unread={unreadCount}
          pending={pending}
        />
        <div className="sidebar-foot">
          <span className={`connection-dot ${online ? '' : 'offline'}`} />
          <span>{t(online ? 'sync.online' : 'sync.offline')}</span>
        </div>
        <Button
          className="ghost drawer-close"
          onClick={() => {
            setMobile(false);
            menuButton.current?.focus();
          }}
        >
          {t('common.close')}
        </Button>
      </aside>
      {mobile && (
        <button
          className="sidebar-shade"
          aria-label={t('common.close')}
          onClick={() => setMobile(false)}
        />
      )}
      <div className="app-main">
        <header className="app-topbar">
          <div className="topbar-start">
            <Link to="/dashboard" className="top-company">
              <span className="myt-wordmark" aria-hidden="true">
                MYT
              </span>
              <span className="top-company-copy">
                <strong>{t('app.name')}</strong>
                <small>{t('design.companyMotto')}</small>
              </span>
            </Link>
            <Button
              className="ghost menu-toggle"
              ref={menuButton}
              aria-label={t('premium.openNavigation')}
              aria-expanded={mobile}
              aria-controls="application-sidebar"
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={20} />
            </Button>
            <Button
              className="ghost desktop-collapse"
              aria-label={t(
                collapsed ? 'premium.expandSidebar' : 'premium.collapseSidebar',
              )}
              aria-expanded={!collapsed}
              aria-controls="application-sidebar"
              onClick={() => {
                setCollapsed(!collapsed);
                localStorage.setItem(
                  'myt-sidebar-collapsed',
                  String(!collapsed),
                );
              }}
            >
              {collapsed ? (
                <PanelLeftOpen size={19} />
              ) : (
                <PanelLeftClose size={19} />
              )}
            </Button>
            <select
              aria-label={t('common.branch')}
              value={selectedBranch}
              onChange={(e) => void changeBranch(e.target.value)}
            >
              {identity.branchIds.map((id) => (
                <option key={id} value={id}>
                  {branchName(id)}
                </option>
              ))}
            </select>
          </div>
          <Button
            className="workspace-search"
            aria-label={t('design.find')}
            title={t('design.findHint')}
            onClick={() => setFinder(true)}
          >
            <Search size={20} />
            <span>{t('design.systemSearch')}</span>
            <kbd>Ctrl K</kbd>
          </Button>
          <div className="topbar-end">
            <div className="topbar-date">
              <CalendarDays size={23} aria-hidden="true" />
              <span>
                <strong>{fmt.date(new Date())}</strong>
                <time dateTime={new Date().toISOString()}>
                  {new Intl.DateTimeFormat('en-CA', {
                    timeZone: 'Asia/Kabul',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                  }).format(new Date())}
                </time>
              </span>
            </div>
            <AppearanceControls />
            <select
              aria-label={t('common.language')}
              value={language}
              onChange={(e) =>
                changeLanguage(e.target.value as typeof language)
              }
            >
              <option value="fa-AF">دری</option>
              <option value="ps-AF">پښتو</option>
              <option value="en">English</option>
            </select>
            {api.allowed('notifications.read') && (
              <details
                className="notification-dropdown"
                ref={notificationMenu}
                onKeyDown={(event) => {
                  if (event.key === 'Escape' && notificationMenu.current) {
                    notificationMenu.current.open = false;
                    notificationMenu.current.querySelector('summary')?.focus();
                  }
                }}
              >
                <summary
                  className="notification-button"
                  aria-label={t('nav.notifications')}
                  title={t('nav.notifications')}
                >
                  <Bell size={20} />
                  {unreadCount > 0 && <span>{unreadCount}</span>}
                </summary>
                <div
                  className="notification-menu"
                  dir={language === 'en' ? 'ltr' : 'rtl'}
                >
                  <strong>{t('nav.notifications')}</strong>
                  {(identity.role === 'admin'
                    ? globalNotifications.data
                    : notifications.data?.items
                  )
                    ?.slice(0, 5)
                    .map((item) => (
                      <NotificationLink record={item} key={item._id}>
                        <strong>
                          <NotificationTitle record={item} />
                        </strong>
                        <small>
                          {branchName(item.branchId)} |{' '}
                          {fmt.date(item.reservationAt)}
                        </small>
                      </NotificationLink>
                    ))}
                  {(
                    identity.role === 'admin'
                      ? globalNotifications.isLoading
                      : notifications.isLoading
                  ) ? (
                    <Loading />
                  ) : (
                      identity.role === 'admin'
                        ? globalNotifications.error
                        : notifications.error
                    ) ? (
                    <ErrorState
                      error={
                        identity.role === 'admin'
                          ? globalNotifications.error
                          : notifications.error
                      }
                    />
                  ) : (
                    unreadCount === 0 && <Empty />
                  )}
                  <Link to="/notifications">
                    {t('nav.notifications')}{' '}
                    <ChevronDown size={14} aria-hidden="true" />
                  </Link>
                </div>
              </details>
            )}
            <details
              className="profile-dropdown"
              ref={profileMenu}
              onKeyDown={(event) => {
                if (event.key === 'Escape' && profileMenu.current) {
                  profileMenu.current.open = false;
                  profileMenu.current.querySelector('summary')?.focus();
                }
              }}
            >
              <summary
                className="identity"
                aria-label={t('premium.profileMenu')}
              >
                <span className="avatar">
                  {identity.development ? 'T' : identity.name.slice(0, 1)}
                </span>
                <div>
                  <strong>
                    {identity.development
                      ? t(`session.${identity.role}`)
                      : identity.name}
                  </strong>
                  <small>{t(`session.${identity.role}`)}</small>
                </div>
                <ChevronDown size={14} />
              </summary>
              <div
                className="profile-menu"
                dir={language === 'en' ? 'ltr' : 'rtl'}
              >
                <strong>{identity.name}</strong>
                <small>{t(`session.${identity.role}`)}</small>
                <div className="profile-preferences-heading">
                  {t('design.preferences')}
                </div>
                <AppearanceControls preferences />
                <Link to="/sessions">
                  <Shield size={16} />
                  {t('nav.sessions')}
                </Link>
                {api.allowed('users.manage') && (
                  <Link to="/users">
                    <Users size={16} />
                    {t('auth.accounts')}
                  </Link>
                )}
                <Button
                  className="ghost danger"
                  onClick={() => void api.endSession().catch(setError)}
                >
                  <LogOut size={16} />
                  {t('auth.logout')}
                </Button>
              </div>
            </details>
          </div>
        </header>
        {navigationMode === 'top' && (
          <AppNavigation horizontal unread={unreadCount} pending={pending} />
        )}

        {identity.development && (
          <div className="environment-banner">{t('session.development')}</div>
        )}
        {!online && <div className="network-banner">{t('auth.offline')}</div>}
        <main className="workspace" key={selectedBranch}>
          <div className="breadcrumb">
            <Link to="/">{t('app.name')}</Link>
            <span>/</span>
            <span>{t(`nav.${active.key}`)}</span>
            <span className="branch-chip">{branchName(selectedBranch)}</span>
          </div>
          {error !== undefined && <ErrorState error={error} />}
          <div className="app-content">
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route path="/sessions" element={<Sessions />} />
                <Route
                  path="/expenses"
                  element={
                    <Protected permission="expenses.read">
                      <Expenses />
                    </Protected>
                  }
                />
                <Route
                  path="/dashboard"
                  element={
                    <Protected permission="dashboard.read">
                      <Dashboard />
                    </Protected>
                  }
                />
                {(
                  [
                    'products',
                    'product-categories',
                    'guarantees',
                    'package-items',
                  ] as const
                ).map((resource) => (
                  <Route
                    key={resource}
                    path={`/${resource}`}
                    element={
                      <Protected permission="catalog.read">
                        <Catalog resource={resource} />
                      </Protected>
                    }
                  />
                ))}
                <Route
                  path="/alterations"
                  element={
                    <Protected permission="alterations.read">
                      <Alterations />
                    </Protected>
                  }
                />
                <Route
                  path="/alterations/:id"
                  element={
                    <Protected permission="alterations.read">
                      <AlterationDetail />
                    </Protected>
                  }
                />
                <Route
                  path="/alterations/:id/receipt"
                  element={
                    <Protected permission="alterations.print">
                      <AlterationDetail receipt />
                    </Protected>
                  }
                />
                <Route
                  path="/customers"
                  element={
                    <Protected permission="customers.read">
                      <Customers />
                    </Protected>
                  }
                />
                <Route
                  path="/customers/:id"
                  element={
                    <Protected permission="customers.read">
                      <CustomerDetail />
                    </Protected>
                  }
                />
                <Route
                  path="/transactions"
                  element={
                    <Protected permission="transactions.read.own">
                      <Transactions />
                    </Protected>
                  }
                />
                <Route
                  path="/transactions/:id"
                  element={
                    <Protected permission="transactions.read.own">
                      <TransactionDetail />
                    </Protected>
                  }
                />
                <Route
                  path="/notifications"
                  element={
                    <Protected permission="notifications.read">
                      <Notifications />
                    </Protected>
                  }
                />
                <Route
                  path="/reports"
                  element={
                    <Protected permission="reports.read">
                      <Reports />
                    </Protected>
                  }
                />
                <Route
                  path="/reports/company"
                  element={
                    <Protected permission="reports.read" adminOnly>
                      <CompanyReportPage />
                    </Protected>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <Protected permission="settings.write">
                      <BranchSettings />
                    </Protected>
                  }
                />
                <Route
                  path="/users"
                  element={
                    <Protected permission="users.manage">
                      <Staff />
                    </Protected>
                  }
                />
                <Route
                  path="/audit-logs"
                  element={
                    <Protected permission="audit.read">
                      <Audit />
                    </Protected>
                  }
                />
                <Route
                  path="/sync"
                  element={
                    <Protected permission="sync.use">
                      <Sync />
                    </Protected>
                  }
                />
                <Route
                  path="/advertisements"
                  element={
                    <Protected permission="advertisements.manage">
                      <Advertisements />
                    </Protected>
                  }
                />
                <Route
                  path="/print/:id"
                  element={
                    <Protected permission="invoices.read">
                      <Print />
                    </Protected>
                  }
                />
                <Route
                  path="/print/local/:localId"
                  element={
                    <Protected permission="invoices.read">
                      <Print />
                    </Protected>
                  }
                />
                <Route
                  path="*"
                  element={
                    <ErrorState error={new api.ApiError(404, 'not_found')} />
                  }
                />
              </Routes>
            </Suspense>
          </div>
        </main>
      </div>
      {finder && <WorkspaceFinder onClose={() => setFinder(false)} />}
      <Toasts />
    </div>
  );
}
function SessionApp() {
  const location = useLocation();
  const [identity, setIdentity] = useState<SessionIdentity>(),
    [error, setError] = useState<unknown>();
  const connect = () => {
    setError(undefined);
    void api.bootstrap().then(setIdentity).catch(setError);
  };
  useEffect(() => {
    if (!identity) return;
    let checking = false;
    const validate = async () => {
      if (checking || !api.session()) return;
      checking = true;
      try {
        if (navigator.onLine) await api.refreshIdentity();
        else api.liveLease();
      } catch (error) {
        if (!(error instanceof api.ApiError)) {
          try {
            api.liveLease();
          } catch {
            await api.endSession();
          }
        } else if (error.status === 401) await api.endSession();
      } finally {
        checking = false;
      }
    };
    const timer = setInterval(() => void validate(), 30000);
    window.addEventListener('online', validate);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', validate);
    };
  }, [identity]);
  useEffect(() => {
    connect();
    const changed = () => {
      queryClient.clear();
      setIdentity(undefined);
      connect();
    };
    window.addEventListener('myt-identity-changed', changed);
    const ended = () => {
      queryClient.clear();
      setIdentity(undefined);
      setError(new api.ApiError(401, 'identity_required'));
    };
    window.addEventListener('myt-auth-ended', ended);
    return () => {
      window.removeEventListener('myt-identity-changed', changed);
      window.removeEventListener('myt-auth-ended', ended);
    };
  }, []);
  if (error)
    return (
      <Suspense fallback={<Loading />}>
        {location.pathname === '/login' ? (
          <Login onLogin={connect} />
        ) : (
          <Navigate to="/login" replace />
        )}
      </Suspense>
    );
  if (!identity) return <Loading />;
  if (location.pathname === '/login')
    return <Navigate to="/dashboard" replace />;
  return <Workspace identity={identity} />;
}
export function App() {
  const location = useLocation();
  return location.pathname === '/' ? (
    <Suspense fallback={<Loading />}>
      <Home />
    </Suspense>
  ) : (
    <SessionApp />
  );
}
