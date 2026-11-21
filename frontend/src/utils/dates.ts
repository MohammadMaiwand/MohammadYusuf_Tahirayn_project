import { toJalaali } from 'jalaali-js';
// Date-only values must stay YYYY-MM-DD strings. Instants are stored as UTC ISO.
export function formatAfghanDate(instant: Date, language = 'fa-AF') {
  return new Intl.DateTimeFormat(`${language}-u-ca-persian`, {
    timeZone: 'Asia/Kabul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(instant);
}
// Adapter for future Jalali date-only pickers; does not perform timezone conversion.
export function formatJalaliLocal(date: Date) {
  const { jy, jm, jd } = toJalaali(date);
  return `${jy}-${String(jm).padStart(2, '0')}-${String(jd).padStart(2, '0')}`;
}
