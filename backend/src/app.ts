import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import pino from 'pino';
import { pinoHttp } from 'pino-http';
import { randomUUID } from 'node:crypto';
import type { Environment } from './config/env.js';
import { HttpError } from './utils/errors.js';
import { z } from 'zod';
import { businessRouter, type IdentityResolver } from './routes/business.js';
import { publicAdvertisementRoutes } from './modules/advertisements/routes.js';
import { authRouter } from './modules/auth/routes.js';
import { cookie } from './modules/auth/core.js';
export function createApp(
  env: Environment,
  ready: () => boolean = () => false,
  testIdentity?: IdentityResolver,
) {
  const app = express();
  app.disable('x-powered-by');
  const logger = pino({
    level: env.LOG_LEVEL,
    redact: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers.set-cookie',
    ],
  });
  app.use(
    pinoHttp({
      logger,
      genReqId: () => randomUUID(),
      serializers: {
        req: (req) => ({
          id: req.id,
          method: req.method,
          url: String(req.url).split('?')[0],
        }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  );
  app.use(helmet());
  const origins = env.CORS_ORIGINS.split(',').map((s) => s.trim());
  app.use((req, _res, next) => {
    const origin = req.get('origin');
    if (origin && !origins.includes(origin))
      return next(new HttpError(403, 'origin_denied'));
    next();
  });
  app.use(
    cors({
      credentials: true,
      origin: (origin, cb) => cb(null, !origin || origins.includes(origin)),
    }),
  );
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: env.RATE_LIMIT_MAX,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (_req, _res, next) => next(new HttpError(429, 'rate_limited')),
    }),
  );
  app.use((req, res, next) =>
    express.json({
      limit:
        /^\/api\/v1\/(branches\/[^/]+\/clothing-photos|advertisements\/photos)$/.test(
          req.path,
        ) && req.method === 'POST'
          ? '7mb'
          : '100kb',
    })(req, res, next),
  );
  app.use((req, _res, next) => {
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      (req.path.startsWith('/api/v1/auth/') ||
        cookie(req, 'myt_access') ||
        cookie(req, 'myt_refresh')) &&
      req.get('x-myt-request') !== '1'
    )
      return next(new HttpError(403, 'csrf_denied'));
    next();
  });
  app.get('/api/v1/health', (_req, res) =>
    res.json({ status: 'ok', phase: 1 }),
  );
  app.get('/api/v1/ready', (_req, res) =>
    res
      .status(ready() ? 200 : 503)
      .json({ status: ready() ? 'ready' : 'unavailable' }),
  );
  app.use('/api/v1/public', publicAdvertisementRoutes());
  app.use('/api/v1', authRouter(env));
  app.use('/api/v1', businessRouter(env, testIdentity));
  app.use((_req, _res, next) => next(new HttpError(404, 'Route not found')));
  app.use(((error, req, res, _next) => {
    const status =
      error instanceof z.ZodError
        ? 422
        : error instanceof HttpError
          ? error.status
          : error instanceof SyntaxError
            ? 400
            : error?.type === 'entity.too.large'
              ? 413
              : 500;
    if (status >= 500)
      req.log.error(
        { event: 'request_failed', requestId: req.id },
        'Request failed',
      );
    res.status(status).json({
      error: {
        message:
          error instanceof z.ZodError
            ? 'validation_failed'
            : status === 500
              ? 'Internal server error'
              : status === 400
                ? 'Invalid request'
                : status === 413
                  ? 'Request body too large'
                  : error.message,
        requestId: req.id,
        ...(error instanceof z.ZodError
          ? {
              fields: error.issues.map((issue) => ({
                path: issue.path.join('.'),
                code: issue.code,
              })),
            }
          : {}),
      },
    });
  }) as express.ErrorRequestHandler);
  return app;
}
