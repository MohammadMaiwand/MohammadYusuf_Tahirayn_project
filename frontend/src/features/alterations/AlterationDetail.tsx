import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { Alteration } from '../../types/business';
import { allowed } from '../../services/api';
import {
  Button,
  Confirm,
  ErrorState,
  Loading,
  useFormat,
  useSave,
  Field,
} from '../../components/common/ui';
import { ClothingPhoto } from '../../components/common/ClothingPhoto';
import { useAlterations, alterationCommand } from './api';
import AlterationForm from './AlterationForm';
export default function AlterationDetail({
  receipt = false,
}: {
  receipt?: boolean;
}) {
  const { id } = useParams();
  const { t } = useTranslation();
  const fmt = useFormat();
  const query = useAlterations<Alteration>(
    `/alterations/${id}${receipt ? '/receipt' : ''}`,
  );
  const [edit, setEdit] = useState(false),
    [target, setTarget] = useState(''),
    [status, setStatus] = useState('in_progress');
  const retry = useRef({ payload: '', id: crypto.randomUUID() });
  const update = useSave(
    async (next: string) => {
      const payload = JSON.stringify({
        status: next,
        expectedVersion: query.data!.version,
      });
      if (retry.current.payload !== payload)
        retry.current = { payload, id: crypto.randomUUID() };
      return alterationCommand(
        'alteration.status',
        JSON.parse(payload),
        retry.current.id,
        query.data!._id,
      );
    },
    () => setTarget(''),
  );
  if (query.isLoading) return <Loading />;
  if (query.error)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  if (!query.data) return null;
  const row = query.data;
  const terminal = ['delivered', 'cancelled'].includes(row.status);
  async function print() {
    await document.fonts.ready;
    await Promise.all(
      Array.from(
        document.querySelectorAll<HTMLImageElement>('.alteration-receipt img'),
      ).map((image) => image.decode().catch(() => {})),
    );
    window.print();
  }
  return (
    <>
      {receipt && (
        <style media="print">
          {'@page { size: A4 portrait; margin: 12mm; }'}
        </style>
      )}
      <div className="page-heading print-exclude">
        <h1>
          {t(receipt ? 'alteration.receipt' : 'nav.alterations')} -{' '}
          {row.garmentId}
        </h1>
        <div className="row-actions">
          <Link to="/alterations">{t('nav.alterations')}</Link>
          {!receipt &&
            !terminal &&
            allowed('alterations.update') &&
            allowed('alterations.financial') && (
              <Button onClick={() => setEdit(true)}>{t('common.edit')}</Button>
            )}
          {allowed('alterations.print') &&
            (receipt ? (
              <Button onClick={() => void print()}>
                {t('alteration.print')}
              </Button>
            ) : (
              <Link to={'/alterations/' + row._id + '/receipt'}>
                {t('alteration.print')}
              </Link>
            ))}
        </div>
      </div>
      <article className={receipt ? 'alteration-receipt panel' : 'panel'}>
        <header>
          <h2>{row.company?.companyName || t('app.company')}</h2>
          <p>
            {row.company?.address} - {row.company?.telephone}
          </p>
          <p>{t('branch.' + row.branchId)}</p>
          {receipt && <h3>{t('alteration.receipt')}</h3>}
          <p className="code">{row.code}</p>
        </header>
        <div className="customer-strip">
          <strong>{row.customerName}</strong>
          <span>{row.customerCode}</span>
          <span dir="ltr">{row.telephone}</span>
          <span dir="ltr">{row.whatsapp}</span>
        </div>
        <ClothingPhoto photoId={row.photoId} branchId={row.branchId} large />
        <dl className="alteration-details">
          {[
            ['garmentId', row.garmentId],
            ['garmentName', row.garmentName],
            ['garmentType', row.garmentType],
            ['brand', row.brand],
            ['color', row.color],
            ['type', t('alteration.type.' + row.alterationType)],
            ['description', row.description],
            [
              'original',
              row.originalMinor === undefined
                ? '-'
                : fmt.money(
                    row.originalMinor,
                    row.originalCurrency || row.currency,
                  ),
            ],
            [
              'price',
              row.alterationMinor === undefined
                ? '-'
                : fmt.money(row.alterationMinor, row.currency),
            ],
            ['currency', row.currency],
            ['tailor', row.tailorName],
            ['start', fmt.date(row.startAt)],
            ['expected', fmt.date(row.expectedAt)],
            ['duration', row.durationDays + ' ' + t('alteration.days')],
            ['status', t('alteration.status.' + row.status)],
            ['notes', row.notes],
          ].map(([key, value]) => (
            <div key={key}>
              <dt>{t('alteration.' + key)}</dt>
              <dd>{value || '-'}</dd>
            </div>
          ))}
        </dl>
        <p className="muted">{t('alteration.financialNote')}</p>
      </article>
      <div className="row-actions print-exclude">
        {allowed('customers.read') && (
          <Link to={'/customers/' + row.customerId}>
            {t('customer.profile')}
          </Link>
        )}
        {row.transactionId && allowed('transactions.read.own') && (
          <Link to={'/transactions/' + row.transactionId}>
            {t('nav.transactions')}
          </Link>
        )}
      </div>
      {!receipt && !terminal && allowed('alterations.status') && (
        <section className="panel print-exclude">
          <div className="row-actions">
            <Field label="field.status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {[
                  'pending',
                  'in_progress',
                  'ready',
                  'delivered',
                  'cancelled',
                ].map((key) => (
                  <option key={key} value={key}>
                    {t('alteration.status.' + key)}
                  </option>
                ))}
              </select>
            </Field>
            <Button onClick={() => setTarget(status)}>
              {t('alteration.updateStatus')}
            </Button>
            <Button onClick={() => setTarget('delivered')}>
              {t('alteration.deliver')}
            </Button>
            <Button
              className="ghost danger"
              onClick={() => setTarget('cancelled')}
            >
              {t('alteration.cancel')}
            </Button>
          </div>
          {update.error && <ErrorState error={update.error} />}
        </section>
      )}
      {target && (
        <Confirm
          busy={update.isPending}
          onCancel={() => setTarget('')}
          onConfirm={() => update.mutate(target)}
        >
          {t('alteration.status.' + target)}
          {update.error && <ErrorState error={update.error} />}
        </Confirm>
      )}
      {edit && <AlterationForm record={row} onClose={() => setEdit(false)} />}
    </>
  );
}
