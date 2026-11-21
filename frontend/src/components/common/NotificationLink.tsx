import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { Notification } from '../../types/business';
import { branch, selectBranch } from '../../services/api';
import { useFormat, toast } from './ui';
export function NotificationTitle({ record }: { record: Notification }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  return (
    <>
      {t('notification.' + record.type, {
        name: record.customerName,
        garmentId: record.garmentId || '',
        date: fmt.date(record.reservationAt),
        branch: t('branch.' + record.branchId),
      })}
    </>
  );
}
export function NotificationLink({
  record,
  children,
}: {
  record: Notification;
  children: ReactNode;
}) {
  const target = record.alterationId
    ? '/alterations/' + record.alterationId
    : '/transactions/' + record.transactionId;
  return (
    <BranchScopedLink
      record={record}
      target={target}
      className="notification-record-link"
    >
      {children}
    </BranchScopedLink>
  );
}
export function NotificationCustomerLink({
  record,
  children,
}: {
  record: Notification;
  children: ReactNode;
}) {
  return (
    <BranchScopedLink
      record={record}
      target={'/customers/' + record.customerId}
      className="notification-customer-link"
    >
      {children}
    </BranchScopedLink>
  );
}
function BranchScopedLink({
  record,
  target,
  className,
  children,
}: {
  record: Notification;
  target: string;
  className: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <Link
      to={target}
      className={className}
      onClick={(event) => {
        event.preventDefault();
        void (async () => {
          if (branch() !== record.branchId) {
            await selectBranch(record.branchId);
            localStorage.setItem('myt-branch', record.branchId);
            window.dispatchEvent(new Event('myt-identity-changed'));
          }
          navigate(target);
        })().catch(() => toast('error.branch_denied'));
      }}
    >
      {children}
    </Link>
  );
}
