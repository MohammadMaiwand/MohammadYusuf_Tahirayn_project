import { useQuery } from '@tanstack/react-query';
import * as api from '../../services/api';
import { ensureDevice } from '../../offline/operations';
import { deviceId } from '../../offline/vault';
import type { Command } from '@myt/shared';
export function useAlterations<T>(path: string, enabled = true) {
  const branch = api.branch();
  return useQuery({
    queryKey: ['alterations', branch, path],
    queryFn: () => api.request<T>(`/branches/${branch}${path}`),
    enabled,
    gcTime: 0,
    refetchInterval: 30000,
  });
}
export async function alterationCommand<T>(
  action: Command['action'],
  data: unknown,
  operationId: string,
  targetId?: string,
  expectedVersion?: number,
): Promise<T> {
  if (!navigator.onLine) throw new api.ApiError(503, 'online_required');
  const release = api.beginWrite();
  try {
    const branch = api.branch();
    await ensureDevice();
    return await api.request<T>(`/branches/${branch}/commands`, {
      method: 'POST',
      body: JSON.stringify({
        action,
        data,
        operationId,
        deviceId: deviceId(),
        ...(targetId ? { targetId } : {}),
        ...(expectedVersion ? { expectedVersion } : {}),
      }),
    });
  } finally {
    release();
  }
}
