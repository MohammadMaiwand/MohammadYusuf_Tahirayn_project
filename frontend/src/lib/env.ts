import { z } from 'zod';
export const env = z
  .object({
    VITE_API_URL: z.url().default('http://127.0.0.1:4000/api/v1'),
    VITE_OFFLINE_SYNC_ENABLED: z.enum(['true', 'false']).default('false'),
    VITE_AUTH_PUBLIC_KEY: z.string().default(''),
  })
  .parse(import.meta.env);

// Local development must stay local even if a temporary tunnel override remains.
// The Vite /api proxy forwards to the local backend without requiring internet.
if (
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  ['127.0.0.1', 'localhost'].includes(window.location.hostname)
) {
  env.VITE_API_URL = `${window.location.origin}/api/v1`;
}
