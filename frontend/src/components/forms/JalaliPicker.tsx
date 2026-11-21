import { useState } from 'react';
import {
  toGregorian,
  isValidJalaaliDate,
  jalaaliMonthLength,
} from 'jalaali-js';
import { useTranslation } from 'react-i18next';
import { afghanParts, useFormat, Button } from '../common/ui';
export function jalaliInstant(year: number, month: number, day: number) {
  if (year < 1350 || year > 1500 || !isValidJalaaliDate(year, month, day))
    throw new Error('invalid_date');
  const date = toGregorian(year, month, day);
  return new Date(
    `${date.gy}-${String(date.gm).padStart(2, '0')}-${String(date.gd).padStart(2, '0')}T00:00:00+04:30`,
  ).toISOString();
}
export function JalaliPicker({
  value,
  onChange,
  onClear,
  label,
  required = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  label: string;
  required?: boolean;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const [open, setOpen] = useState(false);
  const [parts, setParts] = useState(
    afghanParts(value ? new Date(value) : new Date()),
  );
  const valid =
    parts.year >= 1350 &&
    parts.year <= 1500 &&
    isValidJalaaliDate(parts.year, parts.month, parts.day);
  return (
    <div className="date-picker">
      <label className="field">
        <span>
          {t(label)}
          {required ? ' *' : ''}
        </span>
        <button
          type="button"
          className="date-display"
          aria-expanded={open}
          aria-label={t(label)}
          onClick={() => {
            if (value) setParts(afghanParts(new Date(value)));
            setOpen(!open);
          }}
        >
          {value ? format.date(value) : t('calendar.pick')}
        </button>
      </label>
      {onClear && value && (
        <Button type="button" className="ghost" onClick={onClear}>
          {t('common.clear')}
        </Button>
      )}
      {open && (
        <div
          className="date-popup"
          role="group"
          aria-label={t('calendar.pick')}
        >
          <label>
            {t('calendar.year')}
            <input
              type="number"
              min={1350}
              max={1500}
              value={parts.year}
              onChange={(e) =>
                setParts({ ...parts, year: Number(e.target.value) })
              }
            />
          </label>
          <label>
            {t('calendar.month')}
            <select
              value={parts.month}
              onChange={(e) =>
                setParts({ ...parts, month: Number(e.target.value), day: 1 })
              }
            >
              {t('calendar.months')
                .split(',')
                .map((month, index) => (
                  <option key={index} value={index + 1}>
                    {month}
                  </option>
                ))}
            </select>
          </label>
          <label>
            {t('calendar.day')}
            <select
              value={parts.day}
              onChange={(e) =>
                setParts({ ...parts, day: Number(e.target.value) })
              }
            >
              {Array.from(
                {
                  length:
                    parts.year >= 1350 && parts.year <= 1500
                      ? jalaaliMonthLength(parts.year, parts.month)
                      : 30,
                },
                (_, index) => (
                  <option key={index} value={index + 1}>
                    {index + 1}
                  </option>
                ),
              )}
            </select>
          </label>
          <Button
            type="button"
            className="secondary"
            onClick={() => {
              const today = afghanParts(new Date());
              setParts(today);
              onChange(jalaliInstant(today.year, today.month, today.day));
              setOpen(false);
            }}
          >
            {t('common.today')}
          </Button>
          <Button
            disabled={!valid}
            type="button"
            onClick={() => {
              onChange(jalaliInstant(parts.year, parts.month, parts.day));
              setOpen(false);
            }}
          >
            {t('common.confirm')}
          </Button>
          <Button
            type="button"
            className="ghost"
            onClick={() => setOpen(false)}
          >
            {t('common.close')}
          </Button>
        </div>
      )}
    </div>
  );
}
export function DateRange({
  from,
  to,
  onChange,
  hideClear = false,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  hideClear?: boolean;
}) {
  const { t } = useTranslation();
  function preset(type: string) {
    const now = new Date();
    const parts = afghanParts(now);
    const start = jalaliInstant(parts.year, parts.month, parts.day);
    let fromValue = start,
      toValue = new Date(Date.parse(start) + 86400000).toISOString();
    if (type === 'yesterday') {
      fromValue = new Date(Date.parse(start) - 86400000).toISOString();
      toValue = start;
    }
    if (type === 'week') {
      const weekday = new Intl.DateTimeFormat('en', {
        timeZone: 'Asia/Kabul',
        weekday: 'short',
      }).format(now);
      const index = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'].indexOf(
        weekday,
      );
      fromValue = new Date(Date.parse(start) - index * 86400000).toISOString();
    }
    if (type === 'month') {
      fromValue = jalaliInstant(parts.year, parts.month, 1);
      toValue = jalaliInstant(
        parts.month === 12 ? parts.year + 1 : parts.year,
        parts.month === 12 ? 1 : parts.month + 1,
        1,
      );
    }
    onChange(fromValue, toValue);
  }
  return (
    <div className="date-range">
      <select
        aria-label={t('common.custom')}
        value=""
        onChange={(e) => preset(e.target.value)}
      >
        <option value="">{t('common.custom')}</option>
        {['today', 'yesterday', 'week', 'month'].map((key) => (
          <option value={key} key={key}>
            {t(
              key === 'week'
                ? 'common.thisWeek'
                : key === 'month'
                  ? 'common.thisMonth'
                  : `common.${key}`,
            )}
          </option>
        ))}
      </select>
      <JalaliPicker
        label="common.from"
        value={from}
        onChange={(value) => onChange(value, to)}
      />
      <JalaliPicker
        label="common.to"
        value={to ? new Date(Date.parse(to) - 86400000).toISOString() : ''}
        onChange={(value) =>
          onChange(from, new Date(Date.parse(value) + 86400000).toISOString())
        }
      />
      {!hideClear && (
        <Button className="ghost" onClick={() => onChange('', '')}>
          {t('common.clear')}
        </Button>
      )}
    </div>
  );
}
