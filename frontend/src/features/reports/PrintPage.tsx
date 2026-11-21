import { useState, useEffect, type ReactNode } from 'react';
import { useParams, Link, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import type {
  Customer,
  Invoice,
  Settings,
  Transaction,
} from '../../types/business';
import {
  Button,
  useFormat,
  Field,
  useData,
  Loading,
  ErrorState,
} from '../../components/common/ui';
import { InvoicePaper } from '../../components/printing/InvoicePaper';
export default function PrintPage() {
  const { id, localId } = useParams();
  const [params] = useSearchParams();
  const receiptId = params.get('payment') || undefined;
  const [autoPrinted, setAutoPrinted] = useState(false);
  const { t } = useTranslation();
  const fmt = useFormat();
  const [shareError, setShareError] = useState<unknown>();
  const [showPhoto, setShowPhoto] = useState(false);
  const [two, setTwo] = useState(true),
    [copies, setCopies] = useState(true),
    [secondId, setSecondId] = useState(''),
    [selectedSecond, setSelectedSecond] = useState('');
  const [firstPages, setFirstPages] = useState<ReactNode[]>([]),
    [secondPages, setSecondPages] = useState<ReactNode[]>([]);
  const invoice = useData<Invoice>(`/invoices/${id}`, !!id);
  const local = useData<Transaction>(`/transactions/${localId}`, !!localId);
  const customer = useData<Customer>(
    `/customers/${local.data?.customerId}`,
    !!local.data,
  );
  const settings = useData<Settings>('/settings', !!localId);
  const second = useData<Invoice>(
    `/invoices/${selectedSecond}`,
    !!selectedSecond && two && !copies,
  );
  const [provisional, setProvisional] = useState<Invoice>();
  useEffect(() => {
    if (local.data && customer.data && settings.data) {
      const row = local.data;
      setProvisional({
        _id: row._id,
        branchId: row.branchId,
        code: row.code,
        version: row.version,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        createdBy: row.createdBy,
        provisional: true,
        transactionId: row._id,
        customerId: row.customerId,
        transactionVersion: row.version,
        issuedBy: row.createdBy,
        snapshot: {
          transaction: row,
          customer: customer.data,
          payments: row.payments || [],
          settings: settings.data,
          employeeName: row.createdBy,
        },
      });
    }
  }, [local.data, customer.data, settings.data]);
  const first = invoice.data || provisional;
  const other = copies ? first : second.data;
  const receiptMissing =
    !!receiptId &&
    !!first &&
    !first.snapshot.payments.some((payment) => payment._id === receiptId);
  const ready =
    (!receiptId ||
      !!first?.snapshot.payments.some(
        (payment) => payment._id === receiptId,
      )) &&
    firstPages.length > 0 &&
    (!two || (!!other && secondPages.length > 0));
  const papers = receiptMissing
    ? []
    : two && copies
      ? firstPages.flatMap((page, index) => [page, secondPages[index]])
      : two
        ? [...firstPages, ...secondPages]
        : firstPages;
  async function print() {
    await document.fonts.ready;
    await Promise.all(
      Array.from(
        document.querySelectorAll<HTMLImageElement>('.print-sheets img'),
      ).map((image) => image.decode().catch(() => {})),
    );
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    window.print();
  }
  useEffect(() => {
    if (ready && params.has('autoprint') && !autoPrinted) {
      setAutoPrinted(true);
      void print();
    }
  }, [ready, autoPrinted, params]);
  return (
    <div className="print-view">
      <style>{`@media print{@page{size:${two ? '210mm 297mm' : '148mm 210mm'};margin:0;}}`}</style>
      <div className="print-controls">
        <label>
          <input
            type="checkbox"
            checked={showPhoto}
            onChange={(e) => setShowPhoto(e.target.checked)}
          />{' '}
          {t('clothing.showInvoice')}
        </label>
        <div>
          <h1>{t('invoice.preview')}</h1>
          <Link
            to={
              first ? `/transactions/${first.transactionId}` : '/transactions'
            }
          >
            {t('transaction.details')}
          </Link>
        </div>
        <select
          aria-label={t('invoice.preview')}
          value={two ? 'two' : 'one'}
          onChange={(e) => {
            const next = e.target.value === 'two';
            if (next !== two) {
              setFirstPages([]);
              setSecondPages([]);
            }
            setTwo(next);
          }}
        >
          <option value="one">{t('invoice.one')}</option>
          <option value="two">{t('invoice.two')}</option>
        </select>
        {two && (
          <>
            <label className="check">
              <input
                type="checkbox"
                checked={copies}
                onChange={(e) => {
                  setCopies(e.target.checked);
                  setSecondPages([]);
                }}
              />
              {t('invoice.copies')}
            </label>
            {!copies && (
              <>
                <Field label="invoice.second">
                  <input
                    value={secondId}
                    onChange={(e) => setSecondId(e.target.value)}
                    dir="ltr"
                  />
                </Field>
                <Button
                  className="secondary"
                  disabled={!secondId || secondId === first?._id}
                  onClick={() => {
                    setSelectedSecond(secondId.trim());
                    setSecondPages([]);
                  }}
                >
                  {t('common.view')}
                </Button>
              </>
            )}
          </>
        )}
        <Button disabled={!ready} onClick={() => void print()}>
          {t('action.exportPDF')}
        </Button>
        {first && !first.provisional && (
          <a
            className="button secondary"
            target="_blank"
            rel="noopener noreferrer"
            href={(() => {
              const { customer, transaction } = first.snapshot;
              let phone = (customer.whatsapp || customer.telephone).replace(
                /\D/g,
                '',
              );
              if (phone.startsWith('00')) phone = phone.slice(2);
              if (phone.startsWith('0')) phone = '93' + phone.slice(1);
              const message = [
                first.snapshot.settings.companyName,
                `${t('invoice.preview')}: ${first.code}`,
                `${t('field.customer')}: ${customer.fullName}`,
                t('branch.' + first.branchId),
                `${t('field.product')}: ${transaction.product.name}`,
                `${t('field.total')}: ${fmt.money(transaction.totalMinor)}`,
                `${t('field.paid')}: ${fmt.money(transaction.paidMinor)}`,
                `${t('field.balance')}: ${fmt.money((BigInt(transaction.totalMinor) - BigInt(transaction.paidMinor)).toString())}`,
              ].join('\n');
              return /^\d{8,15}$/.test(phone)
                ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
                : undefined;
            })()}
            onClick={(event) => {
              const href = event.currentTarget.getAttribute('href');
              if (!href) {
                event.preventDefault();
                setShareError(new Error(t('error.whatsapp_number_required')));
              }
            }}
          >
            {t('auth.whatsapp')}
          </a>
        )}
        {first && <small>{t('auth.shareReview')}</small>}
        {shareError !== undefined && (
          <p role="alert">{t('error.whatsapp_number_required')}</p>
        )}
      </div>
      {invoice.isLoading || (local.isLoading && !!localId) ? (
        <Loading />
      ) : invoice.error ? (
        <ErrorState error={invoice.error} />
      ) : local.error ? (
        <ErrorState error={local.error} />
      ) : null}
      {receiptMissing && <p role="alert">{t('error.invoice_unavailable')}</p>}
      {second.error && <ErrorState error={second.error} />}
      {first && !receiptMissing && (
        <InvoicePaper
          invoice={first}
          receiptId={receiptId}
          landscape={two}
          onReady={setFirstPages}
          showPhoto={showPhoto}
        />
      )}{' '}
      {two && other && !receiptMissing && (
        <InvoicePaper
          key={other._id + (copies ? 'copy' : 'second')}
          invoice={other}
          receiptId={copies ? receiptId : undefined}
          showPhoto={showPhoto}
          landscape
          onReady={setSecondPages}
        />
      )}
      <main className={`print-sheets ${two ? 'two-up' : 'one-up'}`}>
        {two
          ? Array.from({ length: Math.ceil(papers.length / 2) }, (_, index) => (
              <div className="a4-page" key={index}>
                {papers[index * 2]}
                {papers[index * 2 + 1]}
              </div>
            ))
          : papers}
      </main>
    </div>
  );
}
