import { useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Printer } from 'lucide-react';
import { Button, Modal, useFormat } from '../common/ui';
import { branch } from '../../services/api';

/** Snapshot only the already authorized, displayed page; never fetch hidden rows. */
export function ListPrintButton({
  target,
  title,
  ready,
  page = 1,
  total = 0,
}: {
  target: RefObject<HTMLElement | null>;
  title: string;
  ready: boolean;
  page?: number;
  total?: number;
}) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const button = useRef<HTMLButtonElement>(null);
  const [snapshot, setSnapshot] = useState<{
    node: HTMLElement;
    branchId: string;
    at: Date;
    rows: number;
  }>();
  function open() {
    if (!target.current || !ready) return;
    const node = target.current.cloneNode(true) as HTMLElement;
    node
      .querySelectorAll('.print-exclude, .pagination, button')
      .forEach((element) => element.remove());
    node
      .querySelectorAll('[id]')
      .forEach((element) => element.removeAttribute('id'));
    node
      .querySelectorAll('a')
      .forEach((element) => element.removeAttribute('href'));
    setSnapshot({
      node,
      branchId: branch(),
      at: new Date(),
      rows: node.querySelectorAll('tbody tr').length,
    });
  }
  function close() {
    setSnapshot(undefined);
    button.current?.focus();
  }
  return (
    <>
      <Button
        ref={button}
        className="secondary"
        disabled={!ready}
        onClick={open}
      >
        <Printer size={17} />
        {t('printing.list')}
      </Button>
      {snapshot &&
        createPortal(
          <div className="list-print-portal">
            <style media="print">
              {'@page { size: A4 landscape; margin: 10mm; }'}
            </style>
            <Modal
              title="printing.preview"
              onClose={close}
              portal={false}
              size="large"
            >
              <div className="list-print-controls">
                <p>{t('printing.pageNotice')}</p>
                <Button onClick={() => window.print()}>
                  <Printer size={17} />
                  {t('action.exportPDF')}
                </Button>
              </div>
              <section className="list-print-document">
                <header>
                  <h1>{t('app.company')}</h1>
                  <h2>
                    {t(title)} · {t('branch.' + snapshot.branchId)}
                  </h2>
                  <p>
                    {fmt.date(snapshot.at)} ·{' '}
                    {t('printing.pageDetails', {
                      page,
                      rows: snapshot.rows,
                      total,
                    })}
                  </p>
                </header>
                <div
                  ref={(node) => {
                    if (node) node.replaceChildren(snapshot.node);
                  }}
                />
              </section>
            </Modal>
          </div>,
          document.body,
        )}
    </>
  );
}
