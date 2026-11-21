import { describe, expect, it } from 'vitest';
import { deadlineState } from '../src/features/messages/notificationTime.js';

describe('notification deadline colors', () => {
  it('marks elapsed deadlines as past', () => {
    expect(deadlineState(new Date(0).toISOString(), 1)).toBe('past');
  });

  it('marks deadlines within six hours as soon', () => {
    expect(deadlineState(new Date(6 * 60 * 60 * 1000).toISOString(), 0)).toBe(
      'soon',
    );
  });

  it('marks later deadlines as remaining and handles invalid timestamps', () => {
    expect(
      deadlineState(new Date(6 * 60 * 60 * 1000 + 1).toISOString(), 0),
    ).toBe('later');
    expect(deadlineState('invalid-date', 0)).toBe('later');
  });
});
