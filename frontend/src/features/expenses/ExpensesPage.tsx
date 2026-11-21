import { CurrencySelect } from '../../components/forms/CurrencySelect';
import { branchCurrency } from '@myt/shared';
import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { expenseInput } from '@myt/shared';
import * as api from '../../services/api';
import { ensureDevice } from '../../offline/operations';
import { deviceId } from '../../offline/vault';
import { JalaliPicker } from '../../components/forms/JalaliPicker';
import {
  Button,
  Field,
  Modal,
  Loading,
  ErrorState,
  Empty,
  Pagination,
  useFormat,
  useSave,
  useDebounced,
} from '../../components/common/ui';
import type { Entity, Page } from '../../types/business';
import { ListPrintButton } from '../../components/printing/ListPrintButton';

interface Expense extends Entity {
  name: string;
  amountMinor: number;
  currency: 'AFN' | 'USD';
  expenseAt: string;
  spentBy: string;
  description: string;
}
function ExpenseForm({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const operation = useRef({ fingerprint: '', id: '' });
  const form = useForm<
    z.input<typeof expenseInput>,
    unknown,
    z.output<typeof expenseInput>
  >({
    resolver: zodResolver(expenseInput),
    defaultValues: {
      currency: branchCurrency(api.branch()),
      name: '',
      amount: '',
      expenseAt: new Date().toISOString(),
      spentBy: '',
      description: '',
    },
  });
  const save = useSave(async (data: z.output<typeof expenseInput>) => {
    if (!navigator.onLine) throw new api.ApiError(503, 'expenses_online');
    const release = api.beginWrite();
    const selectedBranch = api.branch();
    try {
      await ensureDevice();
      const fingerprint = JSON.stringify(data);
      if (operation.current.fingerprint !== fingerprint)
        operation.current = { fingerprint, id: crypto.randomUUID() };
      return await api.request<Expense>(
        `/branches/${selectedBranch}/commands`,
        {
          method: 'POST',
          body: JSON.stringify({
            action: 'expense.create',
            data,
            operationId: operation.current.id,
            deviceId: deviceId(),
          }),
        },
      );
    } finally {
      release();
    }
  }, onClose);
  return (
    <Modal title="expenses.add" onClose={onClose}>
      <form
        className="form-grid"
        onSubmit={form.handleSubmit((data) => save.mutate(data))}
      >
        <Field label="expenses.name" error={form.formState.errors.name}>
          <input {...form.register('name')} maxLength={160} />
        </Field>
        <CurrencySelect {...form.register('currency')} />
        <Field
          currency={form.watch('currency')}
          label="expenses.amount"
          error={form.formState.errors.amount}
        >
          <input
            {...form.register('amount')}
            inputMode="decimal"
            dir="ltr"
            placeholder="0.00"
          />
        </Field>
        <div>
          <JalaliPicker
            label="expenses.date"
            value={form.watch('expenseAt')}
            onChange={(value) =>
              form.setValue('expenseAt', value, { shouldValidate: true })
            }
            required
          />
          {form.formState.errors.expenseAt && (
            <p role="alert">{t('error.invalid_date')}</p>
          )}
        </div>
        <Field label="expenses.spentBy" error={form.formState.errors.spentBy}>
          <input {...form.register('spentBy')} maxLength={160} />
        </Field>
        <Field
          label="expenses.description"
          error={form.formState.errors.description}
        >
          <textarea {...form.register('description')} maxLength={2000} />
        </Field>
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
    </Modal>
  );
}
export default function ExpensesPage() {
  const printTarget = useRef<HTMLElement>(null);
  const { t } = useTranslation();
  const fmt = useFormat();
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(''),
    [open, setOpen] = useState(false);
  const q = useDebounced(search);
  const selectedBranch = api.branch();
  // In-memory only: expense records never enter the business IndexedDB cache/outbox.
  const query = useQuery({
    queryKey: [selectedBranch, 'expenses', page, q],
    queryFn: () =>
      api.request<Page<Expense>>(
        `/branches/${selectedBranch}/expenses?page=${page}&q=${encodeURIComponent(q)}`,
      ),
    gcTime: 0,
    retry: false,
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t('branch.' + selectedBranch)}</p>
          <h1>{t('nav.expenses')}</h1>
          <p>{t('expenses.scope')}</p>
        </div>
        <div className="row-actions">
          <ListPrintButton
            target={printTarget}
            title="nav.expenses"
            ready={
              !!query.data?.items.length && !query.isFetching && !query.error
            }
            page={page}
            total={query.data?.total ?? 0}
          />
          {api.allowed('expenses.create') && (
            <Button onClick={() => setOpen(true)}>{t('expenses.add')}</Button>
          )}
        </div>
      </div>
      <div className="toolbar">
        <input
          aria-label={t('common.search')}
          placeholder={t('common.search')}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>
      {!navigator.onLine && <p className="notice">{t('expenses.online')}</p>}
      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : !query.data?.items.length ? (
        <Empty />
      ) : (
        <section className="panel" ref={printTarget}>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {[
                    'id',
                    'name',
                    'amount',
                    'date',
                    'spentBy',
                    'description',
                  ].map((key) => (
                    <th key={key}>{t('expenses.' + key)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((item) => (
                  <tr key={item._id}>
                    <td className="code" title={item.code}>
                      {item.code}
                    </td>
                    <td>{item.name}</td>
                    <td dir="ltr">
                      {fmt.money(item.amountMinor, item.currency)}
                    </td>
                    <td>{fmt.date(item.expenseAt)}</td>
                    <td>{item.spentBy}</td>
                    <td
                      style={{
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'anywhere',
                        maxWidth: 360,
                      }}
                    >
                      {item.description || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination data={query.data} onPage={setPage} />
        </section>
      )}
      {open && <ExpenseForm onClose={() => setOpen(false)} />}
    </>
  );
}
