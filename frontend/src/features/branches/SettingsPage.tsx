import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { minorToMoney, settingsInput } from '@myt/shared';
import type { Settings } from '../../types/business';
import {
  Button,
  Field,
  useData,
  useSave,
  Loading,
  ErrorState,
  Confirm,
  toast,
} from '../../components/common/ui';
import { mutate } from '../../offline/operations';
function Editor({ settings }: { settings: Settings }) {
  const { t } = useTranslation();
  const form = useForm({
    defaultValues: {
      branchName: settings.branchName || '',
      companyName: settings.companyName,
      address: settings.address,
      telephone: settings.telephone,
      currency: settings.currency,
      paymentMethods: settings.paymentMethods.join(', '),
      offlinePayments: settings.offlinePayments,
      offlinePaymentLimit: minorToMoney(settings.offlinePaymentLimitMinor),
    },
  });
  const [confirmation, setConfirmation] = useState(false);
  const save = useSave(
    () => {
      const values = form.getValues();
      const parsed = settingsInput.safeParse({
        ...values,
        paymentMethods: values.paymentMethods
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        expectedVersion: settings.version,
      });
      if (!parsed.success) {
        toast('error.validation_failed');
        throw new Error('validation_failed');
      }
      return mutate('settings.update', parsed.data);
    },
    () => setConfirmation(false),
  );
  return (
    <section className="panel">
      <form
        className="form-grid"
        onSubmit={form.handleSubmit(() => setConfirmation(true))}
      >
        {(
          [
            'branchName',
            'companyName',
            'address',
            'telephone',
            'paymentMethods',
            'offlinePaymentLimit',
          ] as const
        ).map((field) => (
          <Field label={`field.${field}`} key={field}>
            <input
              {...form.register(field, {
                required: field !== 'address' && field !== 'telephone',
              })}
            />
          </Field>
        ))}
        <Field label="field.currency">
          <input value={settings.currency} readOnly />
        </Field>
        <label className="check">
          <input type="checkbox" {...form.register('offlinePayments')} />
          {t('field.offlinePayments')}
        </label>
        {save.error && <ErrorState error={save.error} />}
        <div className="form-actions">
          <Button type="submit" loading={save.isPending}>
            {t('common.save')}
          </Button>
        </div>
      </form>
      {confirmation && (
        <Confirm
          onCancel={() => setConfirmation(false)}
          onConfirm={() => save.mutate()}
          busy={save.isPending}
        />
      )}
    </section>
  );
}
export default function SettingsPage() {
  const { t } = useTranslation();
  const query = useData<Settings>('/settings');
  return (
    <>
      <div className="page-heading">
        <h1>{t('nav.settings')}</h1>
      </div>
      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} />
      ) : (
        query.data && <Editor key={query.data.version} settings={query.data} />
      )}
    </>
  );
}
