import {
  useEffect,
  useState,
  useRef,
  useId,
  isValidElement,
  cloneElement,
  type ReactNode,
  type ReactElement,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import { minorToMoney, branchCurrency } from '@myt/shared';
import * as api from '../../services/api';
import { queryClient } from '../../lib/queryClient';
import type { Page } from '../../types/business';
import {
  Inbox,
  X,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
} from 'lucide-react';
export function useData<T>(path: string, enabled = true, refresh?: number) {
  return useQuery({
    queryKey: [api.branch(), path],
    queryFn: () => api.get<T>(path),
    enabled,
    refetchInterval: refresh ?? false,
  });
}
type ToastKind = 'success' | 'error' | 'warning' | 'info';
type ToastMessage = { key: string; kind: ToastKind };
export function toast(
  key: string,
  kind: ToastKind = key.startsWith('error.') ? 'error' : 'success',
) {
  window.dispatchEvent(new CustomEvent('myt-toast', { detail: { key, kind } }));
}
export function useSave<T, V>(
  fn: (value: V) => Promise<T>,
  done?: (value: T) => void,
) {
  return useMutation({
    networkMode: 'always',
    mutationFn: fn,
    onSuccess: (result) => {
      toast(
        (result as { provisional?: boolean })?.provisional
          ? 'sync.local'
          : 'common.saved',
      );
      void queryClient.invalidateQueries();
      done?.(result);
    },
    onError: (error) =>
      toast(
        error instanceof api.ApiError
          ? `error.${error.code}`
          : 'error.request_failed',
      ),
  });
}
export function useFormat() {
  const { t, i18n } = useTranslation();
  return {
    money: (
      minor: number | string,
      currencyCode: string = branchCurrency(api.branch()),
    ) => {
      const text = minorToMoney(minor);
      const [whole = '0', fraction = '00'] = text.split('.');
      const currency = new Intl.NumberFormat(i18n.language, {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const digits = new Intl.NumberFormat(i18n.language, {
        minimumIntegerDigits: 2,
        useGrouping: false,
      }).format(Number(fraction));
      const formatted = currency
        .formatToParts(whole === '-0' ? -0 : BigInt(whole))
        .map((part) => (part.type === 'fraction' ? digits : part.value))
        .join('');
      return formatted.includes(currencyCode)
        ? formatted
        : `${formatted} ${currencyCode}`;
    },
    date: (value: string | Date | undefined | null) => {
      if (!value) return '—';
      const parts = afghanParts(new Date(value));
      const names = t('calendar.months').split(',');
      return `${parts.day} ${names[parts.month - 1]} ${parts.year}`;
    },
  };
}
export function afghanParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', {
    timeZone: 'Asia/Kabul',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date);
  const part = (type: string) =>
    Number(parts.find((item) => item.type === type)?.value);
  return { year: part('year'), month: part('month'), day: part('day') };
}
export function currencyLabel(text: string, currency: string) {
  return currency === 'USD'
    ? text
        .replaceAll('AFN', 'USD')
        .replaceAll('افغانی', 'دالر')
        .replaceAll('افغانۍ', 'ډالر')
    : text;
}
export function Field({
  label,
  error,
  children,
  hint,
  required = false,
  currency,
}: {
  label: string;
  error?: unknown;
  children: ReactNode;
  hint?: string;
  required?: boolean;
  currency?: string | undefined;
}) {
  const { t } = useTranslation();
  const id = useId();
  const control =
    isValidElement(children) && typeof children.type === 'string'
      ? (children as ReactElement<Record<string, unknown>>)
      : undefined;
  const needed = required || !!control?.props.required;
  const message = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const labelText = currencyLabel(
    t(label),
    currency || branchCurrency(api.branch()),
  );
  return (
    <label className={`field ${error ? 'field-invalid' : ''}`}>
      <span>
        {labelText}
        {needed && (
          <abbr
            className="required-mark"
            aria-hidden="true"
            title={t('design.required')}
          >
            {' '}
            *
          </abbr>
        )}
      </span>
      {control
        ? cloneElement(control, {
            'aria-invalid': error ? true : undefined,
            'aria-label': control.props['aria-label'] ?? labelText,
            'aria-describedby': message,
            ...(control.type === 'input' || control.type === 'textarea'
              ? { placeholder: control.props.placeholder ?? labelText }
              : {}),
            ...(required ? { required: true } : {}),
          })
        : children}
      {error ? (
        <small id={message} className="field-error" role="alert">
          {t('error.validation_failed')}
        </small>
      ) : hint ? (
        <small id={message} className="field-hint">
          {t(hint)}
        </small>
      ) : null}
    </label>
  );
}
export function Button({
  children,
  className = '',
  variant,
  loading = false,
  disabled,
  ...props
}: React.ComponentProps<'button'> & {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'success' | 'icon';
  loading?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`button ${variant || ''} ${className}`}
    >
      {loading && (
        <LoaderCircle
          className="button-spinner"
          size={16}
          aria-label={t('design.saving')}
        />
      )}
      {children}
    </button>
  );
}
let openDialogs = 0;
let previousOverflow = '';
let rootWasInert = false;
export function Modal({
  title,
  onClose,
  children,
  size = 'medium',
  description,
  portal = true,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  size?: 'compact' | 'medium' | 'large';
  description?: string | undefined;
  portal?: boolean;
}) {
  const { t } = useTranslation();
  const id = useId();
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const focused = document.activeElement as HTMLElement | null;
    const root = document.getElementById('root');
    if (openDialogs++ === 0) {
      previousOverflow = document.body.style.overflow;
      rootWasInert = root?.inert || false;
      document.body.style.overflow = 'hidden';
      if (root) root.inert = true;
    }
    dialog.current
      ?.querySelector<HTMLElement>('input:not([type="hidden"]),select,textarea')
      ?.focus({ preventScroll: true });
    return () => {
      if (--openDialogs === 0) {
        document.body.style.overflow = previousOverflow;
        if (root) root.inert = rootWasInert;
      }
      if (focused?.isConnected) focused.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      const dialogs = document.querySelectorAll('[data-myt-dialog]');
      if (dialogs[dialogs.length - 1] !== dialog.current) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [onClose]);
  const content = (
    <div
      className={`modal-backdrop modal-size-${size}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialog}
        role="dialog"
        data-myt-dialog
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={description ? `${id}-description` : undefined}
        className={`modal modal-${size}`}
        onKeyDown={(event) => {
          if (event.key !== 'Tab') return;
          const items = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],summary',
            ),
          ).filter((item) => item.getClientRects().length > 0);
          const first = items[0],
            last = items[items.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <div className="modal-heading">
          <div>
            <h2 id={`${id}-title`}>{t(title)}</h2>
            {description && <p id={`${id}-description`}>{t(description)}</p>}
          </div>
          <Button
            type="button"
            className="ghost icon-button"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <X size={20} />
          </Button>
        </div>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
  return portal ? createPortal(content, document.body) : content;
}
export function Status({ value }: { value: string }) {
  const { t } = useTranslation();
  return (
    <span className={`badge status-${value}`}>
      {t(`status.${value}`, { defaultValue: value })}
    </span>
  );
}
export function Loading() {
  return (
    <div className="skeleton" aria-busy="true">
      <i />
      <i />
      <i />
    </div>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  const { t } = useTranslation();
  const key =
    error instanceof api.ApiError
      ? `error.${error.code}`
      : 'error.request_failed';
  return (
    <div role="alert" className="empty error">
      <AlertCircle size={24} aria-hidden="true" />
      <p>{t(key, { defaultValue: t('common.error') })}</p>
      {retry && <Button onClick={retry}>{t('common.retry')}</Button>}
    </div>
  );
}
export function Empty() {
  const { t } = useTranslation();
  return (
    <div className="empty">
      <Inbox aria-hidden="true" size={25} />
      <span>{t('common.empty')}</span>
    </div>
  );
}
export function Pagination({
  data,
  onPage,
}: {
  data: Pick<Page<unknown>, 'page' | 'total' | 'limit'>;
  onPage: (page: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="pagination">
      <span>{t('common.page', { page: data.page, total: data.total })}</span>
      <div>
        <Button
          className="ghost"
          disabled={data.page <= 1}
          onClick={() => onPage(data.page - 1)}
        >
          {t('common.previous')}
        </Button>
        <Button
          className="ghost"
          disabled={data.page * data.limit >= data.total}
          onClick={() => onPage(data.page + 1)}
        >
          {t('common.next')}
        </Button>
      </div>
    </div>
  );
}
export function Toasts() {
  const { t } = useTranslation();
  const [message, setMessage] = useState<ToastMessage | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const listener = (event: Event) => {
      const value = (event as CustomEvent<string | ToastMessage>).detail;
      setMessage(
        typeof value === 'string'
          ? {
              key: value,
              kind: value.startsWith('error.') ? 'error' : 'success',
            }
          : value,
      );
      clearTimeout(timer);
      timer = setTimeout(() => setMessage(null), 6000);
    };
    window.addEventListener('myt-toast', listener);
    return () => {
      window.removeEventListener('myt-toast', listener);
      clearTimeout(timer);
    };
  }, []);
  return message ? (
    <div
      className={`toast toast-${message.kind}`}
      role={message.kind === 'error' ? 'alert' : 'status'}
    >
      {message.kind === 'success' ? (
        <CheckCircle2 size={20} />
      ) : (
        <AlertCircle size={20} />
      )}
      <span>{t(message.key, { defaultValue: t('common.error') })}</span>
      <button aria-label={t('common.close')} onClick={() => setMessage(null)}>
        <X size={17} />
      </button>
    </div>
  ) : null;
}
export function useDebounced(value: string, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
export function Confirm({
  title = 'common.confirmAction',
  onConfirm,
  onCancel,
  busy = false,
  children,
}: {
  title?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Modal title={title} onClose={onCancel} size="compact">
      {children}
      <div className="form-actions">
        <Button className="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button disabled={busy} onClick={onConfirm}>
          {t('common.confirm')}
        </Button>
      </div>
    </Modal>
  );
}
