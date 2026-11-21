import { useState, useRef, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClothingPhoto } from '../../components/common/ClothingPhoto';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';
import { Plus } from 'lucide-react';
import {
  transactionInput,
  customerInput,
  moneyToMinor,
  minorToMoney,
  finalTotal,
  calendarDay,
} from '@myt/shared';
import type {
  Catalog,
  Customer,
  Page,
  Settings,
  Transaction,
} from '../../types/business';
import {
  Button,
  Field,
  Modal,
  ErrorState,
  useData,
  useDebounced,
  useFormat,
  useSave,
} from '../../components/common/ui';
import { CurrencySelect } from '../../components/forms/CurrencySelect';
import { branchCurrency } from '@myt/shared';
import { JalaliPicker } from '../../components/forms/JalaliPicker';
import { mutate } from '../../offline/operations';
import { allowed, request, branch } from '../../services/api';
import { catalogLabel } from '../branches/CatalogPage';
export default function TransactionForm({
  customer,
  registration = false,
  registrationDetails,
  onClose,
  onSaved,
}: {
  customer: Customer;
  registration?: boolean;
  registrationDetails?: {
    fields: ReactNode;
    validate: () => Promise<z.output<typeof customerInput> | undefined>;
  };
  onClose: () => void;
  onSaved: (record: Transaction) => void;
}) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const retry = useRef<{ payload: string; operationId: string } | undefined>(
    undefined,
  );
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [selected, setSelected] = useState<Catalog>();
  const [showPackages, setShowPackages] = useState(false);
  const [backdate, setBackdate] = useState(false);
  const products = useData<Page<Catalog>>(
    `/products?status=active&limit=20&q=${encodeURIComponent(debounced)}`,
  );
  const packages = useData<Page<Catalog>>(
    '/package-items?status=active&limit=100',
  );
  const guarantees = useData<Page<Catalog>>(
    '/guarantees?status=active&limit=100',
  );
  const settings = useData<Settings>('/settings');
  const form = useForm<
    z.input<typeof transactionInput>,
    unknown,
    z.output<typeof transactionInput>
  >({
    resolver: zodResolver(transactionInput),
    defaultValues: {
      customerId: customer._id,
      productId: '',
      type: branch() === 'dollar' ? 'purchase' : 'rental',
      currency: branchCurrency(branch()),
      agreedPrice: '0',
      discount: '0',
      charges: '0',
      advance: '0',
      paymentMethod: 'cash',
      reservationAt: new Date().toISOString(),
      packages: [],
      guarantee: null,
      notes: '',
    },
  });
  const watched = form.watch();
  const availabilityParams = new URLSearchParams({
    reservationAt: watched.reservationAt || new Date().toISOString(),
    type: watched.type || 'rental',
    ...(watched.returnDueAt && watched.type === 'rental'
      ? { returnDueAt: watched.returnDueAt }
      : {}),
  });
  const availabilityPath = `/branches/${branch()}/products/${selected?._id}/availability?${availabilityParams}`;
  const availability = useQuery({
    queryKey: ['availability', availabilityPath],
    queryFn: () => request<{ available: boolean }>(availabilityPath),
    enabled: !!selected && navigator.onLine,
    refetchInterval: 15000,
  });
  const picked = watched.packages || [];
  const guarantee = guarantees.data?.items.find(
    (item) => item._id === watched.guarantee?.typeId,
  );
  const selectedPackages = picked.map((row) => ({
    priceMinor:
      packages.data?.items.find((item) => item._id === row.itemId)
        ?.priceMinor || 0,
    quantity: row.quantity,
  }));
  let total = 0,
    packageTotal = 0,
    advance = 0,
    amountsValid = true;
  try {
    packageTotal = finalTotal(0, selectedPackages);
    total = finalTotal(
      moneyToMinor(watched.agreedPrice || '0'),
      selectedPackages,
      moneyToMinor(watched.discount || '0'),
      moneyToMinor(watched.charges || '0'),
    );
    advance = moneyToMinor(watched.advance || '0');
  } catch {
    amountsValid = false;
  }
  const save = useSave(
    async (data: z.output<typeof transactionInput>) => {
      const details = registrationDetails
        ? await registrationDetails.validate()
        : undefined;
      if (registrationDetails && !details)
        throw new Error(t('error.validation_failed'));
      const payload = JSON.stringify({ data, details });
      if (retry.current?.payload !== payload)
        retry.current = { payload, operationId: crypto.randomUUID() };
      if (!registration)
        return mutate<Transaction>('transaction.create', data, {
          operationId: retry.current.operationId,
        });
      const transaction = Object.fromEntries(
        Object.entries(data).filter(([key]) => key !== 'customerId'),
      );
      const result = await mutate<{ transaction: Transaction }>(
        'customer.register',
        {
          customer: {
            id: customer._id,
            fullName: customer.fullName,
            telephone: customer.telephone,
            whatsapp: customer.whatsapp,
            secondaryPhone: customer.secondaryPhone,
            address: customer.address || '',
            notes: customer.notes,
            ...details,
          },
          transaction,
        },
        { operationId: retry.current.operationId },
      );
      return result.transaction;
    },
    (record) => {
      onClose();
      onSaved(record);
    },
  );
  function selectProduct(value: string) {
    setSearch(value);
    const item = products.data?.items.find(
      (row) => `${row.name} · ${row.clothingId || row.code}` === value,
    );
    if (item) {
      setSelected(item);
      form.setValue('productId', item._id, { shouldValidate: true });
      form.setValue('agreedPrice', minorToMoney(item.priceMinor));
      form.setValue('currency', item.currency || branchCurrency(branch()));
      form.setValue('packages', []);
    } else {
      setSelected(undefined);
      form.setValue('productId', '');
    }
  }
  return (
    <Modal
      size="large"
      description={registration ? 'design.newCustomerHint' : undefined}
      title={registration ? 'action.newCustomer' : 'action.newTransaction'}
      onClose={onClose}
    >
      {!registration && (
        <div className="customer-strip">
          <strong>{customer.fullName}</strong>
          <span className="code">{customer.code}</span>
          <span dir="ltr">{customer.telephone}</span>
        </div>
      )}
      <form
        className="form-grid"
        onSubmit={form.handleSubmit((data) =>
          save.mutate({
            ...data,
            returnDueAt: data.type === 'rental' ? data.returnDueAt : null,
          }),
        )}
      >
        {registrationDetails && (
          <section className="form-section form-grid">
            <h3 className="form-section">{t('customer.profile')}</h3>
            <div className="field">
              <span>{t('field.code')}</span>
              <strong>{t('customer.generatedCode')}</strong>
            </div>
            {registrationDetails.fields}
          </section>
        )}
        {registrationDetails && (
          <h3 className="form-section">{t('nav.transactions')}</h3>
        )}
        <Field
          required
          label="field.product"
          error={form.formState.errors.productId}
        >
          <input
            list="product-search"
            aria-label={t('field.product')}
            value={search}
            onChange={(e) => selectProduct(e.target.value)}
            placeholder={t('common.search')}
            autoComplete="off"
          />
          <datalist id="product-search">
            {products.data?.items.map((item) => (
              <option
                key={item._id}
                value={`${item.name} · ${item.clothingId || item.code}`}
              />
            ))}
          </datalist>
        </Field>
        {products.error && <ErrorState error={products.error} />}
        <Field label="field.type">
          <select {...form.register('type')}>
            <option value="rental">{t('status.rental')}</option>
            <option value="purchase">{t('status.purchase')}</option>
          </select>
        </Field>
        {selected && (
          <div className="snapshot-card">
            <ClothingPhoto photoId={selected.photoId} />
            <strong>
              {selected.clothingId || selected.code} · {selected.name}
            </strong>
            <small>{t('clothing.pending')}</small>
            {navigator.onLine && availability.data && (
              <strong>
                {t(
                  availability.data.available
                    ? 'clothing.available'
                    : 'clothing.unavailable',
                )}
              </strong>
            )}
            {availability.error && <ErrorState error={availability.error} />}
            <span>
              {t('field.price')}:{' '}
              <b dir="ltr">
                {fmt.money(selected.priceMinor, selected.currency)}
              </b>
            </span>
            <span>
              {t('field.productType')}: {selected.productType}
            </span>
            <span>
              {t('field.brand')}: {selected.brand}
            </span>
            <span>
              {t('field.color')}: {selected.color}
            </span>
          </div>
        )}
        <CurrencySelect
          {...form.register('currency')}
          onChange={(event) => {
            form.setValue('currency', event.target.value as 'AFN' | 'USD');
            form.setValue('packages', []);
          }}
        />
        <Field
          currency={watched.currency}
          label="field.agreedPrice"
          error={form.formState.errors.agreedPrice}
        >
          <input
            {...form.register('agreedPrice')}
            inputMode="decimal"
            dir="ltr"
          />
        </Field>
        {(['discount', 'charges'] as const).map((field) => (
          <Field
            key={field}
            currency={watched.currency}
            label={`field.${field}`}
            error={form.formState.errors[field]}
          >
            <input {...form.register(field)} inputMode="decimal" dir="ltr" />
          </Field>
        ))}
        <Field
          currency={watched.currency}
          label="field.advance"
          error={form.formState.errors.advance}
        >
          <input
            {...form.register('advance')}
            inputMode="decimal"
            dir="ltr"
            disabled={!allowed('payments.create')}
          />
        </Field>
        <Field label="field.method">
          <select {...form.register('paymentMethod')}>
            {settings.data?.paymentMethods.map((method) => (
              <option key={method} value={method}>
                {t(`method.${method}`, { defaultValue: method })}
              </option>
            ))}
          </select>
        </Field>
        <JalaliPicker
          label="field.reservationAt"
          value={watched.reservationAt || ''}
          onChange={(value) =>
            form.setValue('reservationAt', value, { shouldValidate: true })
          }
          required
        />
        {watched.type === 'rental' && (
          <JalaliPicker
            label="clothing.returnDue"
            value={watched.returnDueAt || ''}
            onChange={(value) =>
              form.setValue('returnDueAt', value || null, {
                shouldValidate: true,
              })
            }
            onClear={() =>
              form.setValue('returnDueAt', null, { shouldValidate: true })
            }
          />
        )}
        <div className="field">
          <span>{t('field.orderAt')}</span>
          <strong>
            {fmt.date(watched.orderAt || new Date().toISOString())}
          </strong>
          {allowed('transactions.backdate') && (
            <label className="check">
              <input
                type="checkbox"
                checked={backdate}
                onChange={(e) => {
                  setBackdate(e.target.checked);
                  if (!e.target.checked) form.unregister('orderAt');
                }}
              />
              {t('transaction.backdate')}
            </label>
          )}
        </div>
        {backdate && (
          <JalaliPicker
            label="field.orderAt"
            value={watched.orderAt || new Date().toISOString()}
            onChange={(value) => form.setValue('orderAt', value)}
          />
        )}
        <section className="form-section">
          <Button
            type="button"
            className="secondary"
            onClick={() => setShowPackages(!showPackages)}
          >
            <Plus size={18} />
            {t('action.addPackage')}
          </Button>
          <p className="muted">{t('transaction.packagesOptional')}</p>
          {showPackages && (
            <div className="package-options">
              {!packages.data?.items.length ? (
                <p>{t('common.empty')}</p>
              ) : (
                packages.data.items
                  .filter(
                    (item) =>
                      (item.currency || branchCurrency(branch())) ===
                      watched.currency,
                  )
                  .map((item) => {
                    const selection = picked.find(
                      (row) => row.itemId === item._id,
                    );
                    return (
                      <div key={item._id} className="package-option">
                        <label className="check">
                          <input
                            type="checkbox"
                            checked={!!selection}
                            onChange={(e) =>
                              form.setValue(
                                'packages',
                                e.target.checked
                                  ? [
                                      ...picked,
                                      {
                                        itemId: item._id,
                                        quantity: item.quantity,
                                      },
                                    ]
                                  : picked.filter(
                                      (row) => row.itemId !== item._id,
                                    ),
                              )
                            }
                          />
                          <strong>{item.name}</strong>
                          <span dir="ltr">
                            {fmt.money(item.priceMinor, item.currency)}
                          </span>
                          <span>{item.color}</span>
                        </label>
                        {selection && (
                          <input
                            aria-label={`${t('field.quantity')} ${item.name}`}
                            type="number"
                            min={1}
                            max={1000}
                            value={selection.quantity}
                            onChange={(e) =>
                              form.setValue(
                                'packages',
                                picked.map((row) =>
                                  row.itemId === item._id
                                    ? {
                                        ...row,
                                        quantity: Number(e.target.value),
                                      }
                                    : row,
                                ),
                              )
                            }
                          />
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          )}
        </section>
        <Field label="field.guarantee">
          <select
            value={watched.guarantee?.typeId || ''}
            onChange={(e) =>
              form.setValue(
                'guarantee',
                e.target.value ? { typeId: e.target.value, details: '' } : null,
              )
            }
          >
            <option value="">{t('common.optional')}</option>
            {guarantees.data?.items.map((item) => (
              <option key={item._id} value={item._id}>
                {catalogLabel(item, t)}
              </option>
            ))}
          </select>
        </Field>
        {guarantee &&
          (allowed('guarantees.sensitive') ||
            guarantee.guaranteeType === 'manual') && (
            <Field
              label="field.guaranteeDetails"
              error={form.formState.errors.guarantee}
            >
              <input
                maxLength={250}
                value={watched.guarantee?.details || ''}
                onChange={(e) =>
                  form.setValue('guarantee', {
                    typeId: guarantee._id,
                    details: e.target.value,
                  })
                }
              />
            </Field>
          )}
        <Field label={registration ? 'design.transactionNotes' : 'field.notes'}>
          <textarea {...form.register('notes')} maxLength={2000} />
        </Field>
        {registration && (
          <div className="totals-box">
            <div>
              <span>{t('field.daysRemaining')}</span>
              <strong>
                {Math.floor(
                  (Date.parse(watched.reservationAt) + 16200000) / 86400000,
                ) - Math.floor((Date.now() + 16200000) / 86400000)}
              </strong>
            </div>
            {watched.type === 'rental' && watched.returnDueAt && (
              <div>
                <span>{t('field.rentalDuration')}</span>
                <strong>
                  {Math.max(
                    0,
                    calendarDay(watched.returnDueAt) -
                      calendarDay(watched.reservationAt),
                  )}{' '}
                  {t('field.days')}
                </strong>
              </div>
            )}
            <div>
              <span>{t('field.delivery')}</span>
              <strong>{t('status.pending')}</strong>
            </div>
            <div>
              <span>{t('field.paid')}</span>
              <strong dir="ltr">{fmt.money(advance, watched.currency)}</strong>
            </div>
          </div>
        )}
        <div className="totals-box">
          <div>
            <span>{t('field.packageTotal')}</span>
            <strong dir="ltr">
              {fmt.money(packageTotal, watched.currency)}
            </strong>
          </div>
          <div>
            <span>{t('field.total')}</span>
            <strong dir="ltr">{fmt.money(total, watched.currency)}</strong>
          </div>
          <div>
            <span>{t('field.balance')}</span>
            <strong dir="ltr">
              {fmt.money(total - advance, watched.currency)}
            </strong>
          </div>
        </div>
        {!amountsValid && (
          <p className="field-error">{t('error.invalid_amount')}</p>
        )}
        {Object.keys(form.formState.errors).length > 0 && (
          <p className="field-error">{t('error.validation_failed')}</p>
        )}
        {save.error && <ErrorState error={save.error} />}
        <div className="form-actions">
          <Button type="button" className="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={
              save.isPending || !selected || !settings.data || !amountsValid
            }
          >
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
