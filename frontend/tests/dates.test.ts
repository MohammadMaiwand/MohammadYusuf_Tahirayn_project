import { it, expect } from 'vitest';
import { formatAfghanDate, formatJalaliLocal } from '../src/utils/dates';
it('formats Nowruz and respects Kabul midnight', () => {
  expect(formatJalaliLocal(new Date(2024, 2, 20))).toBe('1403-01-01');
  const instant = new Date('2024-03-19T20:00:00Z');
  expect(formatAfghanDate(instant, 'en')).toContain('1403');
});
