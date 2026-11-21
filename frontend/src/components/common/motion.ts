import { useSyncExternalStore } from 'react';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)');
const subscribe = (listener: () => void) => {
  const query = reduced();
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
};
export function useReducedMotion() {
  return useSyncExternalStore(
    subscribe,
    () => reduced().matches,
    () => true,
  );
}
