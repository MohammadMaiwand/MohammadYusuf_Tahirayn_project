import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownUp, X } from 'lucide-react';
import { Button } from './ui';

// Only presentation preferences are stored; no rows, queries or customer data.
export function useListOrder(key: string, fields: readonly string[]) {
  const [order, setOrder] = useState(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem(`myt-list-order-${key}`) || '{}',
      );
      return {
        sort: fields.includes(saved.sort)
          ? (saved.sort as string)
          : 'createdAt',
        direction: saved.direction === 'asc' ? 'asc' : 'desc',
      };
    } catch {
      return { sort: 'createdAt', direction: 'desc' };
    }
  });
  useEffect(() => {
    localStorage.setItem(`myt-list-order-${key}`, JSON.stringify(order));
  }, [key, order]);
  return [order, setOrder] as const;
}
export function ListOrder({
  fields,
  order,
  onChange,
  onClear,
}: {
  fields: readonly string[];
  order: { sort: string; direction: string };
  onChange: (order: { sort: string; direction: string }) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="list-order print-exclude">
      <label>
        <ArrowDownUp size={15} />
        {t('design.sort')}
        <select
          value={order.sort}
          onChange={(e) => onChange({ ...order, sort: e.target.value })}
        >
          {fields.map((field) => (
            <option key={field} value={field}>
              {t(`field.${field.replace('Minor', '')}`)}
            </option>
          ))}
        </select>
      </label>
      <select
        aria-label={t('design.direction')}
        value={order.direction}
        onChange={(e) => onChange({ ...order, direction: e.target.value })}
      >
        <option value="desc">{t('design.descending')}</option>
        <option value="asc">{t('design.ascending')}</option>
      </select>
      <Button className="ghost" onClick={onClear}>
        <X size={15} />
        {t('design.clear')}
      </Button>
    </div>
  );
}
