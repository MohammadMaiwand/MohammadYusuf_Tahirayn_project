import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';
import {
  alterationInput,
  alterationTypes,
  alterationDuration,
  minorToMoney,
  branchCurrency,
} from '@myt/shared';
import {
  Button,
  Field,
  Modal,
  ErrorState,
  useData,
  useDebounced,
  useSave,
} from '../../components/common/ui';
import { JalaliPicker } from '../../components/forms/JalaliPicker';
import { CurrencySelect } from '../../components/forms/CurrencySelect';
import { ClothingPhoto } from '../../components/common/ClothingPhoto';
import type {
  Alteration,
  Customer,
  Page,
  Transaction,
} from '../../types/business';
import {
  allowed,
  branch,
  request,
  ApiError,
  beginWrite,
} from '../../services/api';
import { alterationCommand, useAlterations } from './api';
export default function AlterationForm({
  customer,
  transaction,
  record,
  onClose,
  onSaved,
}: {
  customer?: Customer | undefined;
  transaction?: Transaction | undefined;
  record?: Alteration | undefined;
  onClose: () => void;
  onSaved?: ((record: Alteration) => void) | undefined;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const customers = useData<Page<Customer>>(
    `/customers?limit=25&q=${encodeURIComponent(q)}`,
    !customer && !transaction && !record,
  );
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState('');
  const retry = useRef({ payload: '', id: crypto.randomUUID() });
  const form = useForm<
    z.input<typeof alterationInput>,
    unknown,
    z.output<typeof alterationInput>
  >({
    resolver: zodResolver(alterationInput),
    defaultValues: record
      ? {
          customerId: record.customerId,
          transactionId: record.transactionId,
          garmentId: record.garmentId,
          garmentName: record.garmentName,
          garmentType: record.garmentType,
          brand: record.brand,
          color: record.color,
          alterationType: record.alterationType,
          description: record.description,
          originalCurrency: record.originalCurrency || record.currency,
          originalPrice: minorToMoney(record.originalMinor || 0),
          alterationPrice: minorToMoney(record.alterationMinor || 0),
          currency: record.currency,
          tailorName: record.tailorName,
          tailorId: record.tailorId,
          startAt: record.startAt,
          expectedAt: record.expectedAt,
          photoId: record.photoId,
          notes: record.notes,
        }
      : {
          customerId: customer?._id || transaction?.customerId || '',
          transactionId: transaction?._id || null,
          garmentId: '',
          garmentName: transaction?.product.name || '',
          garmentType: transaction?.product.productType || '',
          brand: transaction?.product.brand || '',
          color: transaction?.product.color || '',
          alterationType: 'size',
          description: '',
          originalCurrency:
            transaction?.product.currency ||
            transaction?.currency ||
            branchCurrency(branch()),
          originalPrice: minorToMoney(transaction?.product.originalMinor || 0),
          alterationPrice: '0',
          currency:
            transaction?.product.currency ||
            transaction?.currency ||
            branchCurrency(branch()),
          tailorName: '',
          tailorId: null,
          startAt: new Date().toISOString(),
          expectedAt: new Date().toISOString(),
          photoId: transaction?.product.photoId || null,
          notes: '',
        },
  });
  const value = form.watch();
  const linkedCustomer = useData<Customer>(
    `/customers/${transaction?.customerId}`,
    !!transaction && !customer,
  );
  const actualCustomer = customer || linkedCustomer.data;
  const selected =
    actualCustomer ||
    customers.data?.items.find((row) => row._id === value.customerId);
  const transactions = useData<Page<Transaction>>(
    `/transactions?customerId=${value.customerId}&limit=100`,
    !!value.customerId && allowed('transactions.read.own') && !transaction,
  );
  function selectTransaction(id: string) {
    form.setValue('transactionId', id || null);
    const linked = transactions.data?.items.find((row) => row._id === id);
    if (linked && !record) {
      form.setValue(
        'originalPrice',
        minorToMoney(linked.product.originalMinor),
      );
      form.setValue(
        'originalCurrency',
        linked.product.currency || linked.currency,
      );
      form.setValue('garmentName', linked.product.name);
      form.setValue('garmentType', linked.product.productType);
      form.setValue('brand', linked.product.brand);
      form.setValue('color', linked.product.color);
      form.setValue('photoId', linked.product.photoId || null);
    }
  }
  const tailors = useAlterations<{ _id: string; name: string }[]>(
    '/alterations/tailors',
  );
  useEffect(() => {
    if (!file) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const save = useSave(
    async (data: z.output<typeof alterationInput>) => {
      const release = beginWrite();
      try {
        if (file) {
          if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
            throw new ApiError(422, 'invalid_photo');
          if (file.size > 5 * 1024 * 1024)
            throw new ApiError(413, 'photo_too_large');
          const encoded = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(',')[1]!);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          data.photoId = (
            await request<{ photoId: string }>(
              `/branches/${branch()}/clothing-photos?purpose=alteration`,
              { method: 'POST', body: JSON.stringify({ data: encoded }) },
            )
          ).photoId;
          form.setValue('photoId', data.photoId);
          setFile(undefined);
        }
        const payload = JSON.stringify(data);
        if (retry.current.payload !== payload)
          retry.current = { payload, id: crypto.randomUUID() };
        return await alterationCommand<Alteration>(
          record ? 'alteration.update' : 'alteration.create',
          data,
          retry.current.id,
          record?._id,
          record?.version,
        );
      } finally {
        release();
      }
    },
    (result) => {
      onSaved?.(result);
      onClose();
    },
  );
  return (
    <Modal
      size="large"
      title={record ? 'alteration.edit' : 'alteration.new'}
      onClose={onClose}
    >
      <form
        className="form-grid"
        onSubmit={form.handleSubmit((data) => save.mutate(data))}
      >
        {actualCustomer || record ? (
          <div className="customer-strip form-section">
            <strong>{actualCustomer?.fullName || record?.customerName}</strong>
            <span>{actualCustomer?.code || record?.customerCode}</span>
            <span dir="ltr">
              {actualCustomer?.telephone || record?.telephone}
            </span>
            <span dir="ltr">
              {actualCustomer?.whatsapp || record?.whatsapp}
            </span>
            <span>{t('branch.' + branch())}</span>
          </div>
        ) : (
          <>
            <Field label="common.search">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Field>
            <Field
              label="field.customer"
              required
              error={form.formState.errors.customerId}
            >
              <select
                value={value.customerId || ''}
                onChange={(e) => {
                  form.setValue('customerId', e.target.value);
                  form.setValue('transactionId', null);
                }}
              >
                <option value="">{t('common.select')}</option>
                {customers.data?.items.map((row) => (
                  <option value={row._id} key={row._id}>
                    {row.code} - {row.fullName} - {row.telephone}
                  </option>
                ))}
              </select>
            </Field>
            {customers.error && <ErrorState error={customers.error} />}
            {selected && (
              <p className="customer-strip form-section">
                {selected.code} - {selected.fullName} - {selected.telephone} -{' '}
                {selected.whatsapp} - {t('branch.' + branch())}
              </p>
            )}
          </>
        )}
        <Field label="nav.transactions">
          <select
            value={value.transactionId || ''}
            disabled={!!transaction}
            onChange={(e) => selectTransaction(e.target.value)}
          >
            <option value="">{t('common.optional')}</option>
            {transaction ? (
              <option value={transaction._id}>{transaction.code}</option>
            ) : (
              transactions.data?.items.map((row) => (
                <option key={row._id} value={row._id}>
                  {row.code} - {row.product.name}
                </option>
              ))
            )}
          </select>
        </Field>
        {(
          ['garmentId', 'garmentName', 'garmentType', 'brand', 'color'] as const
        ).map((field) => (
          <Field
            key={field}
            label={'alteration.' + field}
            required={['garmentId', 'garmentName', 'garmentType'].includes(
              field,
            )}
            error={form.formState.errors[field]}
          >
            <input
              {...form.register(field)}
              maxLength={field === 'garmentId' ? 64 : 160}
            />
          </Field>
        ))}
        <Field label="alteration.type">
          <select {...form.register('alterationType')}>
            {alterationTypes.map((type) => (
              <option key={type} value={type}>
                {t('alteration.type.' + type)}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="alteration.description"
          required
          error={form.formState.errors.description}
        >
          <textarea {...form.register('description')} maxLength={2000} />
        </Field>
        <CurrencySelect {...form.register('currency')} disabled={!!record} />
        <CurrencySelect
          label="alteration.originalCurrency"
          {...form.register('originalCurrency')}
          disabled={!!record || !!value.transactionId}
        />
        <Field
          label="alteration.original"
          currency={value.originalCurrency}
          error={form.formState.errors.originalPrice}
        >
          <input
            {...form.register('originalPrice')}
            inputMode="decimal"
            dir="ltr"
            readOnly={!!record || !!value.transactionId}
          />
        </Field>
        <Field
          label="alteration.price"
          currency={value.currency}
          error={form.formState.errors.alterationPrice}
        >
          <input
            {...form.register('alterationPrice')}
            inputMode="decimal"
            dir="ltr"
          />
        </Field>
        <Field
          label="alteration.tailor"
          required
          error={form.formState.errors.tailorName}
        >
          <input
            {...form.register('tailorName')}
            list="alteration-tailors"
            onChange={(e) => {
              form.setValue('tailorName', e.target.value);
              form.setValue(
                'tailorId',
                tailors.data?.find((row) => row.name === e.target.value)?._id ||
                  null,
              );
            }}
          />
          <datalist id="alteration-tailors">
            {tailors.data?.map((row) => (
              <option key={row._id} value={row.name} />
            ))}
          </datalist>
        </Field>
        <JalaliPicker
          label="alteration.start"
          value={value.startAt || ''}
          onChange={(date) =>
            form.setValue('startAt', date, { shouldValidate: true })
          }
          required
        />
        <JalaliPicker
          label="alteration.expected"
          value={value.expectedAt || ''}
          onChange={(date) =>
            form.setValue('expectedAt', date, { shouldValidate: true })
          }
          required
        />
        <div className="totals-box">
          <span>{t('alteration.duration')}</span>
          <strong>
            {Math.max(
              0,
              alterationDuration(value.startAt || '', value.expectedAt || ''),
            )}{' '}
            {t('alteration.days')}
          </strong>
        </div>
        <Field label="clothing.photo">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0])}
          />
        </Field>
        <div className="row-actions">
          {preview ? (
            <img
              className="clothing-photo large"
              src={preview}
              alt={t('clothing.photo')}
            />
          ) : (
            <ClothingPhoto photoId={value.photoId} />
          )}
          <Button
            type="button"
            className="ghost"
            onClick={() => {
              setFile(undefined);
              form.setValue('photoId', null);
            }}
          >
            {t('alteration.removePhoto')}
          </Button>
        </div>
        <Field label="field.notes">
          <textarea {...form.register('notes')} maxLength={2000} />
        </Field>
        {Object.keys(form.formState.errors).length > 0 && (
          <p className="field-error" role="alert">
            {form.formState.errors.expectedAt
              ? t('error.invalid_alteration_dates')
              : t('error.validation_failed')}
          </p>
        )}
        {save.error && <ErrorState error={save.error} />}
        <div className="form-actions">
          <Button type="button" className="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            loading={save.isPending}
            disabled={
              alterationDuration(value.startAt || '', value.expectedAt || '') <
              0
            }
          >
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
