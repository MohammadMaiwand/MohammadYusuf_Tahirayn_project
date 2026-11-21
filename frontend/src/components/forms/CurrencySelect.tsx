import type { SelectHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { Field } from '../common/ui';
export function CurrencySelect({
  label = 'field.currency',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  const { t } = useTranslation();
  return (
    <Field label={label}>
      <select {...props}>
        {(['AFN', 'USD'] as const).map((code) => (
          <option key={code} value={code}>
            {t(`currency.${code}`)}
          </option>
        ))}
      </select>
    </Field>
  );
}
