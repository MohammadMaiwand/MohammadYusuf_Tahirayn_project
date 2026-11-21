import { z } from 'zod';
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().min(1024).max(65535).default(4000),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(10000).default(120),
  HOST: z.string().default('127.0.0.1'),
  MONGODB_URI: z.string().regex(/^mongodb(?:\+srv)?:\/\//),
  FRONTEND_URL: z.url().default('http://localhost:5173'),
  CORS_ORIGINS: z
    .string()
    .refine(
      (value) =>
        value.split(',').every((item) => {
          try {
            const url = new URL(item.trim());
            return (
              ['http:', 'https:'].includes(url.protocol) &&
              url.origin === item.trim()
            );
          } catch {
            return false;
          }
        }),
      'Must contain exact HTTP origins',
    )
    .default('http://localhost:5173,http://127.0.0.1:5173'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  JWT_SECRET: z.string().min(32).optional(),
  AUTH_PRIVATE_KEY: z.string().optional(),
  JWT_ISSUER: z.string().default('myt-system'),
  JWT_AUDIENCE: z.string().default('myt-client'),
  OFFLINE_SYNC_ENABLED: z.enum(['true', 'false']).default('false'),
  DEV_IDENTITY_ENABLED: z.enum(['true', 'false']).default('false'),
  DEV_ROLE: z.enum(['admin', 'manager', 'employee']).default('admin'),
  DEV_BRANCH_ID: z
    .enum(['dollar', 'sham-royal', 'sham-aroos', 'sham-aroos-vip'])
    .default('sham-royal'),
  APP_TIMEZONE: z.literal('Asia/Kabul').default('Asia/Kabul'),
  APP_CALENDAR: z.literal('persian').default('persian'),
});
export type Environment = z.infer<typeof envSchema>;
export function parseEnv(input: NodeJS.ProcessEnv): Environment {
  const result = envSchema.safeParse(input);
  if (!result.success)
    throw new Error(
      `Invalid environment keys: ${result.error.issues.map((i) => i.path.join('.')).join(', ')}`,
    );
  if (
    result.data.DEV_IDENTITY_ENABLED === 'true' &&
    (result.data.NODE_ENV !== 'development' ||
      !['127.0.0.1', 'localhost', '::1'].includes(result.data.HOST))
  )
    throw new Error(
      'Development identity is restricted to loopback development only',
    );
  return result.data;
}
