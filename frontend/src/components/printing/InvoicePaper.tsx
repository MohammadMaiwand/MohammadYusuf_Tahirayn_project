import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Invoice } from '../../types/business';
import { ClothingPhoto } from '../common/ClothingPhoto';
import { useFormat, currencyLabel } from '../common/ui';
export function InvoicePaper({
  invoice,
  landscape,
  onReady,
  showPhoto = false,
  receiptId,
}: {
  invoice: Invoice;
  landscape: boolean;
  onReady: (papers: ReactNode[]) => void;
  showPhoto?: boolean;
  receiptId?: string | undefined;
}) {
  const { t, i18n } = useTranslation();
  const format = useFormat();
  const fmt = {
    ...format,
    money: (value: number | string) =>
      format.money(value, invoice.snapshot.transaction.currency),
  };
  const measure = useRef<HTMLDivElement>(null);
  const [pagination, setPagination] = useState<number[][]>([]);
  const { transaction: row, customer, payments, settings } = invoice.snapshot;
  const line = (label: string, value: ReactNode) => (
    <div className="bill-line">
      <span>
        {currencyLabel(
          t(label),
          label === 'field.price'
            ? row.product.currency || row.currency
            : row.currency,
        )}
      </span>
      <strong>{value || '—'}</strong>
    </div>
  );
  const receipt = payments.find((payment) => payment._id === receiptId);
  const blocks: ReactNode[] = [
    ...(receipt
      ? [
          <div className="bill-receipt bill-info">
            {line('field.code', receipt.code)}
            {line('field.paymentAt', fmt.date(receipt.paymentAt))}
            {line('field.amount', fmt.money(receipt.amountMinor))}
            {line('field.reference', receipt.reference || '')}
          </div>,
        ]
      : []),
    <div className="bill-info">
      {line('field.customer', customer.fullName)}
      {line('field.code', customer.code)}
      {line('field.whatsapp', <bdi>{customer.whatsapp}</bdi>)}
      {line('field.telephone', <bdi>{customer.telephone}</bdi>)}
      {customer.address && line('field.address', customer.address)}
    </div>,
    <div className="bill-info">
      {line('field.product', row.product.name)}
      {line('clothing.id', row.product.clothingId || row.product.code)}
      {showPhoto && (
        <ClothingPhoto
          photoId={row.product.photoId}
          branchId={invoice.branchId}
        />
      )}
      {line('field.productType', row.product.productType)}
      {line('field.brand', row.product.brand)}
      {line('field.color', row.product.color)}
      {line('field.type', t(`status.${row.type}`))}
      {line(
        'field.price',
        <bdi>
          {format.money(
            row.product.originalMinor,
            row.product.currency || row.currency,
          )}
        </bdi>,
      )}
      {line('field.agreedPrice', <bdi>{fmt.money(row.agreedMinor)}</bdi>)}
      {line('field.orderAt', fmt.date(row.orderAt))}
      {line('field.reservationAt', fmt.date(row.reservationAt))}
      {line('field.delivery', t(`status.${row.status}`))}
    </div>,
    ...row.packages.map((item) => (
      <div className="bill-line item-line">
        <span>
          {item.name} · {item.color}
        </span>
        <bdi>
          {item.quantity} × {fmt.money(item.priceMinor)} ={' '}
          {fmt.money(item.quantity * item.priceMinor)}
        </bdi>
      </div>
    )),
    ...(row.guarantee
      ? [
          <div>
            {line(
              'field.guarantee',
              t(`guarantee.${row.guarantee.type}`, {
                defaultValue: row.guarantee.name,
              }),
            )}
            {row.guarantee.details && <p>{row.guarantee.details}</p>}
            {line('field.status', t(`status.${row.guarantee.status}`))}
            {line('field.createdAt', fmt.date(row.guarantee.receivedAt))}
            {row.guarantee.returnedAt &&
              line('status.returned', fmt.date(row.guarantee.returnedAt))}
          </div>,
        ]
      : []),
    <div className="bill-totals">
      {line('field.packageTotal', <bdi>{fmt.money(row.packageMinor)}</bdi>)}
      {!!row.discountMinor &&
        line('field.discount', <bdi>{fmt.money(row.discountMinor)}</bdi>)}
      {!!row.chargesMinor &&
        line('field.charges', <bdi>{fmt.money(row.chargesMinor)}</bdi>)}
      {line('field.total', <bdi>{fmt.money(row.totalMinor)}</bdi>)}
      {line(
        'field.advance',
        <bdi>
          {fmt.money(
            payments
              .filter((payment) => payment.origin === 'advance')
              .reduce((sum, payment) => sum + payment.amountMinor, 0),
          )}
        </bdi>,
      )}
      {line(
        'transaction.paymentHistory',
        <bdi>
          {fmt.money(
            payments
              .filter((payment) => payment.origin !== 'advance')
              .reduce((sum, payment) => sum + payment.amountMinor, 0),
          )}
        </bdi>,
      )}
      {line('field.paid', <bdi>{fmt.money(row.paidMinor)}</bdi>)}
      {line(
        'field.balance',
        <bdi>{fmt.money(row.totalMinor - row.paidMinor)}</bdi>,
      )}
    </div>,
    ...payments
      .filter((payment) => !receiptId || payment._id === receiptId)
      .map((payment) => (
        <div className="bill-line">
          <span>
            {t(`status.${payment.kind}`)} · {fmt.date(payment.paymentAt)} ·{' '}
            {t(`method.${payment.method}`, { defaultValue: payment.method })}
          </span>
          <bdi>{fmt.money(payment.amountMinor)}</bdi>
        </div>
      )),
    ...((row.notes || '').match(/[\s\S]{1,280}/g) || []).map((chunk, index) => (
      <div className="bill-notes">
        {index === 0 && <strong>{t('field.notes')}</strong>}
        <p>{chunk}</p>
      </div>
    )),
    <div className="bill-info">
      {line('field.employee', invoice.issuedBy)}
      {line('invoice.printedAt', fmt.date(invoice.createdAt))}
      <p>{t('invoice.signature')}</p>
    </div>,
  ];
  const header = (
    <header className="bill-header">
      <div>
        <h2>{settings.companyName}</h2>
        <p>{t(`branch.${invoice.branchId}`)}</p>
        {settings.address && <p>{settings.address}</p>}
        {settings.telephone && <p dir="ltr">{settings.telephone}</p>}
      </div>
      <div>
        <strong>{t(receiptId ? 'workflow.receipt' : 'invoice.title')}</strong>
        <p className="bill-code">{invoice.code}</p>
      </div>
    </header>
  );
  useLayoutEffect(() => {
    let alive = true;
    const calculate = () => {
      if (!alive || !measure.current) return;
      const node = measure.current;
      const style = getComputedStyle(node);
      const height =
        ((landscape ? 148 : 210) * 96) / 25.4 -
        parseFloat(style.paddingTop) -
        parseFloat(style.paddingBottom) -
        node.querySelector('.bill-header')!.getBoundingClientRect().height -
        28;
      const groups: number[][] = [[]];
      let used = 0;
      const elements = node.querySelectorAll<HTMLElement>('[data-print-block]');
      elements.forEach((element, index) => {
        const amount = element.getBoundingClientRect().height + 6;
        if (used + amount > height && groups.at(-1)!.length) {
          groups.push([]);
          used = 0;
        }
        groups.at(-1)!.push(index);
        used += amount;
      });
      setPagination(groups);
    };
    void document.fonts.ready.then(async () => {
      await Promise.all(
        Array.from(nodeImages()).map((image) => image.decode().catch(() => {})),
      );
      calculate();
    });
    function nodeImages() {
      return measure.current?.querySelectorAll<HTMLImageElement>('img') || [];
    }
    window.addEventListener('resize', calculate);
    return () => {
      alive = false;
      window.removeEventListener('resize', calculate);
    };
  }, [invoice, landscape, i18n.language, showPhoto, receiptId]);
  useLayoutEffect(() => {
    if (!pagination.length) return;
    onReady(
      pagination.map((indices, index) => (
        <article
          className={`invoice-paper ${landscape ? 'landscape' : 'portrait'}`}
          key={`${invoice._id}-${index}`}
          data-invoice-id={invoice._id}
        >
          {header}
          {invoice.provisional && (
            <strong className="bill-provisional">
              {t('sync.provisional')}
            </strong>
          )}
          <div className="bill-content">
            {indices.map((block) => (
              <section className="bill-block" key={block}>
                {blocks[block]}
              </section>
            ))}
          </div>
          <footer className="bill-footer">
            <span>{invoice.code}</span>
            <span>
              {index > 0 ? t('invoice.continued') : ''} {index + 1}/
              {pagination.length}
            </span>
          </footer>
        </article>
      )),
    );
  }, [pagination, invoice, landscape, i18n.language, showPhoto, receiptId]);
  return (
    <div
      className={`invoice-paper print-measure ${landscape ? 'landscape' : 'portrait'}`}
      ref={measure}
      aria-hidden="true"
    >
      {header}
      {blocks.map((block, index) => (
        <section className="bill-block" key={index} data-print-block>
          {block}
        </section>
      ))}
    </div>
  );
}
