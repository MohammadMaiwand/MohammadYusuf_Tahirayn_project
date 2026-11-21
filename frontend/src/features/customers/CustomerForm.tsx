import { useState } from 'react';
import { useNavigate } from 'react-router';
import { allowed } from '../../services/api';
import TransactionForm from '../transactions/TransactionForm';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { customerInput } from '@myt/shared';
import { mutate } from '../../offline/operations';
import {
  Field,
  Button,
  Modal,
  useSave,
  ErrorState,
} from '../../components/common/ui';
import type { Customer } from '../../types/business';
export default function CustomerForm({
  customer,
  onClose,
  onSaved,
}: {
  customer?: Customer;
  onClose: () => void;
  onSaved?: (customer: Customer) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [draft] = useState<Customer>(() => ({
    _id: crypto.randomUUID(),
    branchId: '',
    code: '',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: '',
    fullName: '',
    telephone: '',
    whatsapp: '',
    secondaryPhone: '',
    address: '',
    notes: '',
  }));
  const form = useForm({
    resolver: zodResolver(customerInput),
    defaultValues: customer
      ? {
          address: customer.address || '',
          fullName: customer.fullName,
          whatsapp: customer.whatsapp,
          telephone: customer.telephone,
          secondaryPhone: customer.secondaryPhone,
          notes: customer.notes,
        }
      : {
          address: '',
          fullName: '',
          whatsapp: '',
          telephone: '',
          secondaryPhone: '',
          notes: '',
        },
  });
  const save = useSave(
    (data: unknown) =>
      mutate<Customer>(
        customer ? 'customer.update' : 'customer.create',
        data,
        customer
          ? { targetId: customer._id, expectedVersion: customer.version }
          : {},
      ),
    (result) => {
      onSaved?.(result);
      onClose();
    },
  );
  const fields = (
    <>
      {(['fullName', 'telephone', 'whatsapp', 'secondaryPhone'] as const).map(
        (field) => (
          <Field
            key={field}
            label={`field.${field}`}
            required={field === 'fullName' || field === 'telephone'}
            error={form.formState.errors[field]}
          >
            <input
              {...form.register(field)}
              dir={field === 'fullName' ? undefined : 'ltr'}
              type={field === 'fullName' ? 'text' : 'tel'}
              autoComplete="off"
            />
          </Field>
        ),
      )}
      <Field label="field.address">
        <textarea {...form.register('address')} />
      </Field>
      <Field label="design.customerNotes">
        <textarea {...form.register('notes')} />
      </Field>
    </>
  );
  if (!customer && allowed('transactions.create'))
    return (
      <TransactionForm
        customer={draft}
        registration
        registrationDetails={{
          fields,
          validate: async () => {
            if (!(await form.trigger())) return undefined;
            return customerInput.parse(form.getValues());
          },
        }}
        onClose={onClose}
        onSaved={(transaction) => {
          onClose();
          navigate(`/transactions/${transaction._id}`);
        }}
      />
    );
  return (
    <Modal
      title={customer ? 'common.edit' : 'action.newCustomer'}
      onClose={onClose}
    >
      <form
        className="form-grid"
        onSubmit={form.handleSubmit((data) => save.mutate(data))}
      >
        {fields}
        {save.error && <ErrorState error={save.error} />}
        <div className="form-actions">
          <Button type="button" className="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button loading={save.isPending} type="submit">
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
