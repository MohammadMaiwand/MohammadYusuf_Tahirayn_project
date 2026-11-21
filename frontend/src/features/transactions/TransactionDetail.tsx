import AlterationsPage from '../alterations/AlterationsPage';
import { CurrencySelect } from '../../components/forms/CurrencySelect';
import { useState, useRef } from 'react';
import { ClothingPhoto } from '../../components/common/ClothingPhoto';
import { Link, useParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';
import {
  paymentInput,
  transactionEditInput,
  deliveryInput,
  minorToMoney,
  settlement,
} from '@myt/shared';
import type { Transaction, Payment, Settings } from '../../types/business';
import {
  Button,
  Field,
  Modal,
  useData,
  useFormat,
  useSave,
  Loading,
  ErrorState,
  Empty,
  Status,
  Confirm,
  currencyLabel,
} from '../../components/common/ui';
import { JalaliPicker } from '../../components/forms/JalaliPicker';
import { mutate } from '../../offline/operations';
import { allowed } from '../../services/api';
import { InvoicePrintButton } from '../../components/printing/InvoicePrintButton';
export function PaymentForm({
  transaction,
  onClose,
}: {
  transaction: Transaction;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const settings = useData<Settings>('/settings');
  const form = useForm<
    z.input<typeof paymentInput>,
    unknown,
    z.output<typeof paymentInput>
  >({
    resolver: zodResolver(paymentInput),
    defaultValues: {
      currency: transaction.currency,
      transactionId: transaction._id,
      amount: minorToMoney(
        Math.max(0, transaction.totalMinor - transaction.paidMinor),
      ),
      method: settings.data?.paymentMethods[0] || 'cash',
      paymentAt: new Date().toISOString(),
      expectedVersion: transaction.version,
      reference: '',
      notes: '',
    },
  });
  const retry = useRef<{ payload: string; operationId: string } | undefined>(
    undefined,
  );
  const save = useSave((data: unknown) => {
    const payload = JSON.stringify(data);
    if (retry.current?.payload !== payload)
      retry.current = { payload, operationId: crypto.randomUUID() };
    return mutate('payment.create', data, {
      operationId: retry.current.operationId,
    });
  }, onClose);
  return (
    <Modal title="action.addPayment" onClose={onClose}>
      <form
        className="form-grid"
        onSubmit={form.handleSubmit((data) => save.mutate(data))}
      >
        <CurrencySelect value={transaction.currency} disabled />
        <Field
          currency={transaction.currency}
          label="field.amount"
          error={form.formState.errors.amount}
        >
          <input {...form.register('amount')} inputMode="decimal" dir="ltr" />
        </Field>
        <Field label="field.method">
          <select {...form.register('method')}>
            {settings.data?.paymentMethods.map((method) => (
              <option key={method} value={method}>
                {t(`method.${method}`, { defaultValue: method })}
              </option>
            ))}
          </select>
        </Field>
        {allowed('transactions.backdate') && (
          <JalaliPicker
            label="field.paymentAt"
            value={form.watch('paymentAt') || ''}
            onChange={(value) => form.setValue('paymentAt', value)}
          />
        )}
        <Field label="field.reference">
          <input {...form.register('reference')} maxLength={100} />
        </Field>
        <Field label="field.notes">
          <textarea {...form.register('notes')} />
        </Field>
        {save.error && <ErrorState error={save.error} />}
        <div className="form-actions">
          <Button type="button" className="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={save.isPending || !settings.data}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function DeliveryForm({
  transaction,
  onClose,
}: {
  transaction: Transaction;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const transitions: Record<string, string[]> = {
    pending: ['ready', 'cancelled'],
    ready: ['pending', 'delivered', 'cancelled'],
    delivered: transaction.type === 'rental' ? ['returned'] : ['delivered'],
    returned: ['returned'],
    cancelled: ['cancelled'],
  };
  const statuses = transitions[transaction.status] || [];
  const form = useForm<
    z.input<typeof deliveryInput>,
    unknown,
    z.output<typeof deliveryInput>
  >({
    resolver: zodResolver(deliveryInput),
    defaultValues: {
      expectedVersion: transaction.version,
      status: statuses[0] as Transaction['status'],
      notes: '',
      returnGuarantee: false,
    },
  });
  const [confirm, setConfirm] = useState(false);
  const save = useSave(
    (data: z.output<typeof deliveryInput>) =>
      mutate('delivery.update', data, { targetId: transaction._id }),
    onClose,
  );
  return (
    <Modal title="action.delivery" onClose={onClose}>
      <form
        className="form-grid"
        onSubmit={form.handleSubmit(() => setConfirm(true))}
      >
        <Field label="field.delivery">
          <select {...form.register('status')}>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {t(`status.${status}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="field.notes">
          <textarea {...form.register('notes')} />
        </Field>
        {transaction.guarantee?.status === 'received' && (
          <label className="check">
            <input type="checkbox" {...form.register('returnGuarantee')} />
            {t('field.returnGuarantee')}
          </label>
        )}
        {save.error && <ErrorState error={save.error} />}
        <div className="form-actions">
          <Button type="button" className="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={save.isPending}>
            {t('common.save')}
          </Button>
        </div>
      </form>
      {confirm && (
        <Confirm
          busy={save.isPending}
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            setConfirm(false);
            save.mutate(deliveryInput.parse(form.getValues()));
          }}
        />
      )}
    </Modal>
  );
}
export function TransactionEditor({
  transaction,
  onClose,
}: {
  transaction: Transaction;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const form = useForm({
    defaultValues: {
      discount: minorToMoney(transaction.discountMinor || 0),
      charges: minorToMoney(transaction.chargesMinor || 0),
      agreedPrice: minorToMoney(transaction.agreedMinor),
      reservationAt: transaction.reservationAt,
      notes: transaction.notes,
    },
  });
  const save = useSave(
    () =>
      mutate(
        'transaction.update',
        transactionEditInput.parse({
          ...form.getValues(),
          expectedVersion: transaction.version,
        }),
        { targetId: transaction._id },
      ),
    onClose,
  );
  return (
    <Modal title="common.edit" onClose={onClose}>
      <form
        className="form-grid"
        onSubmit={form.handleSubmit(() => save.mutate())}
      >
        <CurrencySelect value={transaction.currency} disabled />
        <Field currency={transaction.currency} label="field.agreedPrice">
          <input
            {...form.register('agreedPrice')}
            inputMode="decimal"
            required
          />
        </Field>
        {(['discount', 'charges'] as const).map((field) => (
          <Field
            key={field}
            currency={transaction.currency}
            label={`field.${field}`}
          >
            <input {...form.register(field)} inputMode="decimal" />
          </Field>
        ))}
        <JalaliPicker
          label="field.reservationAt"
          value={form.watch('reservationAt')}
          onChange={(value) => form.setValue('reservationAt', value)}
        />
        <Field label="field.notes">
          <textarea {...form.register('notes')} />
        </Field>
        {save.error && <ErrorState error={save.error} />}
        <Button type="submit" loading={save.isPending}>
          {t('common.save')}
        </Button>
      </form>
    </Modal>
  );
}
export default function TransactionDetail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const fmt = useFormat();
  const query = useData<Transaction>(`/transactions/${id}`);
  const [edit, setEdit] = useState(false);
  const [payment, setPayment] = useState(false),
    [delivery, setDelivery] = useState(false),
    [reversal, setReversal] = useState<Payment>(),
    [reason, setReason] = useState('');
  const reverse = useSave(
    () =>
      mutate(
        'payment.reverse',
        { reason, expectedVersion: query.data!.version },
        { targetId: reversal!._id },
      ),
    () => {
      setReversal(undefined);
      setReason('');
    },
  );
  if (query.isLoading) return <Loading />;
  if (query.error)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  if (!query.data) return null;
  const row = query.data;
  const reversed = new Set(
    row.payments?.filter((p) => p.kind === 'reversal').map((p) => p.reversalOf),
  );
  return (
    <>
      {edit && (
        <TransactionEditor transaction={row} onClose={() => setEdit(false)} />
      )}
      {allowed('transactions.update') &&
        ['pending', 'ready'].includes(row.status) && (
          <Button className="secondary" onClick={() => setEdit(true)}>
            {t('common.edit')}
          </Button>
        )}
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t('transaction.details')}</p>
          <h1>{row.customerName}</h1>
          <p className="code muted">{row.code}</p>
        </div>
        <div className="row-actions">
          <Link
            className="button secondary"
            to={`/customers/${row.customerId}`}
          >
            {t('customer.profile')}
          </Link>
          {allowed('payments.create') && row.status !== 'cancelled' && (
            <Button onClick={() => setPayment(true)}>
              {t('action.addPayment')}
            </Button>
          )}
          {allowed('delivery.write') && (
            <Button className="secondary" onClick={() => setDelivery(true)}>
              {t('action.delivery')}
            </Button>
          )}
          <InvoicePrintButton transaction={row} />
        </div>
      </div>
      {row.provisional && <div className="notice">{t('sync.local')}</div>}
      <div className="stats-grid">
        <article className="stat">
          <span>{t('field.total')}</span>
          <strong dir="ltr">{fmt.money(row.totalMinor, row.currency)}</strong>
        </article>
        <article className="stat">
          <span>{t('field.paid')}</span>
          <strong dir="ltr">{fmt.money(row.paidMinor, row.currency)}</strong>
        </article>
        <article className="stat">
          <span>{t('field.balance')}</span>
          <strong dir="ltr">
            {fmt.money(row.totalMinor - row.paidMinor, row.currency)}
          </strong>
        </article>
        <article className="stat">
          <span>{t('field.settlement')}</span>
          <Status value={settlement(row.totalMinor, row.paidMinor)} />
        </article>
      </div>
      <section className="panel detail-grid">
        <div>
          <h2>{row.product.name}</h2>
          <p>
            {t('clothing.id')}:{' '}
            <bdi>{row.product.clothingId || row.product.code}</bdi>
          </p>
          <ClothingPhoto
            photoId={row.product.photoId}
            branchId={row.branchId}
            large
          />
          <p className="muted">{t('transaction.snapshot')}</p>
          <dl>
            {[
              ['productType', row.product.productType],
              ['brand', row.product.brand],
              ['color', row.product.color],
              [
                'price',
                fmt.money(
                  row.product.originalMinor,
                  row.product.currency || row.currency,
                ),
              ],
              ['agreedPrice', fmt.money(row.agreedMinor, row.currency)],
              ['packageTotal', fmt.money(row.packageMinor, row.currency)],
            ].map(([key, value]) => (
              <div key={key}>
                <dt>
                  {currencyLabel(
                    t(`field.${key}`),
                    key === 'price'
                      ? row.product.currency || row.currency
                      : row.currency,
                  )}
                </dt>
                <dd>{value || '—'}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          <dl>
            <div>
              <dt>{t('field.type')}</dt>
              <dd>
                <Status value={row.type} />
              </dd>
            </div>
            <div>
              <dt>{t('field.delivery')}</dt>
              <dd>
                <Status value={row.status} />
              </dd>
            </div>
            <div>
              <dt>{t('field.orderAt')}</dt>
              <dd>{fmt.date(row.orderAt)}</dd>
            </div>
            <div>
              <dt>{t('field.reservationAt')}</dt>
              <dd>{fmt.date(row.reservationAt)}</dd>
            </div>
            <div>
              <dt>{t('field.daysRemaining')}</dt>
              <dd>
                {Math.floor(
                  (Date.parse(row.reservationAt) + 16200000) / 86400000,
                ) - Math.floor((Date.now() + 16200000) / 86400000)}
              </dd>
            </div>
          </dl>
        </div>
      </section>
      {row.packages.length > 0 && (
        <section className="panel">
          <h2>{t('field.packages')}</h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {['name', 'color', 'quantity', 'price', 'total'].map(
                    (key) => (
                      <th key={key}>{t(`field.${key}`)}</th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {row.packages.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.color}</td>
                    <td>{item.quantity}</td>
                    <td>{fmt.money(item.priceMinor, row.currency)}</td>
                    <td>
                      {fmt.money(item.priceMinor * item.quantity, row.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {row.guarantee && (
        <section className="panel">
          <h2>{t('field.guarantee')}</h2>
          <p>
            {t(`guarantee.${row.guarantee.type}`, {
              defaultValue: row.guarantee.name,
            })}{' '}
            · <Status value={row.guarantee.status} />
          </p>
          {row.guarantee.details && <p>{row.guarantee.details}</p>}
          <p>
            {fmt.date(row.guarantee.receivedAt)} —{' '}
            {fmt.date(row.guarantee.returnedAt)}
          </p>
        </section>
      )}
      {(row.notes || row.deliveryNotes) && (
        <section className="panel">
          <h2>{t('field.notes')}</h2>
          <p className="preserve-lines">{row.notes}</p>
          <p className="preserve-lines">{row.deliveryNotes}</p>
        </section>
      )}
      <section className="panel">
        <h2>{t('transaction.paymentHistory')}</h2>
        {!row.payments?.length ? (
          <Empty />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {[
                    'code',
                    'amount',
                    'method',
                    'paymentAt',
                    'employee',
                    'notes',
                  ].map((key) => (
                    <th key={key}>{t(`field.${key}`)}</th>
                  ))}
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {row.payments.map((item) => (
                  <tr key={item._id}>
                    <td className="code">
                      {item.code}
                      <Status value={item.kind} />
                    </td>
                    <td dir="ltr">
                      {fmt.money(item.amountMinor, row.currency)}
                    </td>
                    <td>
                      {t(`method.${item.method}`, {
                        defaultValue: item.method,
                      })}
                    </td>
                    <td>{fmt.date(item.paymentAt)}</td>
                    <td>{item.employeeName}</td>
                    <td>{item.notes}</td>
                    <td>
                      {item.kind === 'payment' && (
                        <InvoicePrintButton
                          transaction={row}
                          paymentId={item._id}
                        />
                      )}
                      {allowed('payments.reverse') &&
                        item.kind === 'payment' &&
                        !reversed.has(item._id) &&
                        !item.provisional && (
                          <Button
                            className="ghost danger"
                            onClick={() => setReversal(item)}
                          >
                            {t('action.reverse')}
                          </Button>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="panel">
        <h2>{t('transaction.invoiceHistory')}</h2>
        {!row.invoices?.length ? (
          <Empty />
        ) : (
          <div className="invoice-links">
            {row.invoices.map((invoice) => (
              <Link key={invoice._id} to={`/print/${invoice._id}`}>
                <span className="code">{invoice.code}</span>
                <span>{fmt.date(invoice.createdAt)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
      {allowed('alterations.read') && <AlterationsPage transaction={row} />}
      {payment && (
        <PaymentForm transaction={row} onClose={() => setPayment(false)} />
      )}{' '}
      {delivery && (
        <DeliveryForm transaction={row} onClose={() => setDelivery(false)} />
      )}{' '}
      {reversal && (
        <Confirm
          busy={reverse.isPending || reason.trim().length < 3}
          onCancel={() => setReversal(undefined)}
          onConfirm={() => reverse.mutate()}
        >
          <Field label="field.reason">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={2000}
            />
          </Field>
          {reverse.error && <ErrorState error={reverse.error} />}
        </Confirm>
      )}
    </>
  );
}
