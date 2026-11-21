import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { settlement } from '@myt/shared';
import type { Transaction } from '../../types/business';
import { Status, useFormat, Empty } from '../../components/common/ui';
import { InvoicePrintButton } from '../../components/printing/InvoicePrintButton';
import { allowed } from '../../services/api';
export default function TransactionTable({ items }: { items: Transaction[] }) {
  const { t } = useTranslation();
  const fmt = useFormat();
  if (!items.length) return <Empty />;
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {allowed('invoices.read') && (
              <th className="print-exclude">{t('action.print')}</th>
            )}
            {[
              'code',
              'customer',
              'product',
              'type',
              'orderAt',
              'reservationAt',
              'total',
              'paid',
              'balance',
              'delivery',
              'settlement',
            ].map((key) => (
              <th key={key}>{t(`field.${key}`)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row._id}>
              {allowed('invoices.read') && (
                <td className="print-exclude">
                  <InvoicePrintButton transaction={row} />
                </td>
              )}
              <td>
                <Link className="code" to={`/transactions/${row._id}`}>
                  {row.code}
                </Link>
                {row.provisional && <small>{t('sync.local')}</small>}
              </td>
              <td>{row.customerName}</td>
              <td>{row.product?.name}</td>
              <td>
                <Status value={row.type} />
              </td>
              <td>{fmt.date(row.orderAt)}</td>
              <td>{fmt.date(row.reservationAt)}</td>
              <td dir="ltr">{fmt.money(row.totalMinor, row.currency)}</td>
              <td dir="ltr">{fmt.money(row.paidMinor, row.currency)}</td>
              <td dir="ltr">
                {fmt.money(row.totalMinor - row.paidMinor, row.currency)}
              </td>
              <td>
                <Status value={row.status} />
              </td>
              <td>
                <Status value={settlement(row.totalMinor, row.paidMinor)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
