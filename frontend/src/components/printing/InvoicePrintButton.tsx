import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Printer } from 'lucide-react';
import { Button, ErrorState } from '../common/ui';
import * as api from '../../services/api';
import { mutate } from '../../offline/operations';
import type { Invoice, Transaction } from '../../types/business';

export function InvoicePrintButton({
  transaction,
  paymentId,
}: {
  transaction: Pick<Transaction, '_id' | 'provisional'>;
  paymentId?: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const printQuery =
    '?autoprint=1' +
    (paymentId ? '&payment=' + encodeURIComponent(paymentId) : '');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>();
  if (!api.allowed('invoices.read')) return null;
  async function open() {
    if (busy) return;
    const release = api.beginWrite();
    setBusy(true);
    setError(undefined);
    try {
      if (transaction.provisional) {
        navigate(`/print/local/${transaction._id}${printQuery}`);
        return;
      }
      const detail = await api.get<Transaction>(
        `/transactions/${transaction._id}`,
      );
      const current = detail.invoices?.find(
        (invoice) => invoice.transactionVersion === detail.version,
      );
      if (current) {
        navigate(`/print/${current._id}${printQuery}`);
        return;
      }
      if (!api.allowed('invoices.issue')) {
        const latest = detail.invoices?.[0];
        if (!latest) throw new api.ApiError(403, 'invoice_unavailable');
        navigate(`/print/${latest._id}${printQuery}`);
        return;
      }
      const invoice = await mutate<Invoice>('invoice.issue', {
        transactionId: detail._id,
      });
      navigate(`/print/${invoice._id}${printQuery}`);
    } catch (caught) {
      setError(caught);
    } finally {
      release();
      setBusy(false);
    }
  }
  return (
    <div className="invoice-print-action">
      <Button className="secondary" disabled={busy} onClick={() => void open()}>
        <Printer size={15} />
        {t(paymentId ? 'workflow.receipt' : 'action.print')}
      </Button>
      {error !== undefined && <ErrorState error={error} />}
    </div>
  );
}
