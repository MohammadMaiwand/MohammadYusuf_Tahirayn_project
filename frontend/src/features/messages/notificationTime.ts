export type DeadlineState = 'past' | 'soon' | 'later';

export function deadlineState(value: string, now = Date.now()): DeadlineState {
  const dueAt = Date.parse(value);
  if (!Number.isFinite(dueAt)) return 'later';
  const remaining = dueAt - now;
  if (remaining <= 0) return 'past';
  return remaining <= 6 * 60 * 60 * 1000 ? 'soon' : 'later';
}
