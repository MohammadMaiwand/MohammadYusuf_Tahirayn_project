import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Entity, Page } from '../../types/business';
import {
  useData,
  useFormat,
  Loading,
  ErrorState,
  Empty,
  Pagination,
} from '../../components/common/ui';
interface Audit extends Entity {
  actorId: string;
  deviceId: string;
  action: string;
  resource: string;
  recordId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}
export default function AuditPage() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const [page, setPage] = useState(1);
  const query = useData<Page<Audit>>(`/audit-logs?page=${page}`);
  return (
    <>
      <div className="page-heading">
        <h1>{t('nav.audit-logs')}</h1>
      </div>
      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} />
      ) : !query.data?.items.length ? (
        <Empty />
      ) : (
        <section className="panel">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {[
                    'field.createdAt',
                    'field.employee',
                    'common.actions',
                    'field.code',
                    'field.description',
                  ].map((key) => (
                    <th key={key}>{t(key)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((row) => (
                  <tr key={row._id}>
                    <td>{fmt.date(row.createdAt)}</td>
                    <td className="code">{row.actorId}</td>
                    <td>
                      {t(`actionCode.${row.action}`, {
                        defaultValue: row.action,
                      })}
                    </td>
                    <td className="code">{row.recordId}</td>
                    <td>
                      <details>
                        <summary>{t('common.view')}</summary>
                        <pre dir="ltr">
                          {JSON.stringify(
                            { before: row.before, after: row.after },
                            null,
                            2,
                          )}
                        </pre>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination data={query.data} onPage={setPage} />
        </section>
      )}
    </>
  );
}
