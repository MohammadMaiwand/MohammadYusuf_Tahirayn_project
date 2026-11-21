import { QueryClient } from '@tanstack/react-query';
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep already-loaded screens instant when navigating back within a
      // minute instead of refetching every 15s; live modules opt into
      // their own shorter refetchInterval.
      networkMode: 'always',
      retry: 1,
      staleTime: 60000,
      gcTime: 5 * 60000,
      refetchOnWindowFocus: true,
    },
  },
});
