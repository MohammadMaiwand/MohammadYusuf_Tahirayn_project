import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { parseEnv } from '../src/config/env.js';
import {
  authorizeBranch,
  scopedIdentity,
} from '../src/security/branchScope.js';
const env = parseEnv({
  MONGODB_URI: 'mongodb://127.0.0.1/test',
  LOG_LEVEL: 'silent',
});
describe('API foundation', () => {
  it('returns a structured rate-limit error and retry information', async () => {
    const app = createApp({ ...env, RATE_LIMIT_MAX: 1 });
    expect((await request(app).get('/api/v1/health')).status).toBe(200);
    const denied = await request(app).get('/api/v1/health');
    expect(denied.status).toBe(429);
    expect(denied.body.error.message).toBe('rate_limited');
    expect(denied.body.error.requestId).toBeTruthy();
    expect(denied.headers['retry-after']).toBeTruthy();
  });
  it('separates liveness and database readiness', async () => {
    const app = createApp(env);
    expect((await request(app).get('/api/v1/health')).status).toBe(200);
    expect((await request(app).get('/api/v1/ready')).status).toBe(503);
    expect(
      (await request(createApp(env, () => true)).get('/api/v1/ready')).status,
    ).toBe(200);
  });
  it('sets security headers, rejects unknown routes and malformed JSON', async () => {
    const app = createApp(env);
    expect((await request(app).get('/missing')).status).toBe(404);
    expect(
      (await request(app).get('/api/v1/health')).headers[
        'x-content-type-options'
      ],
    ).toBe('nosniff');
    expect(
      (
        await request(app)
          .post('/missing')
          .set('Content-Type', 'application/json')
          .send('{')
      ).status,
    ).toBe(400);
  });
  it('does not allow an unconfigured CORS origin', async () => {
    const response = await request(createApp(env))
      .get('/api/v1/health')
      .set('Origin', 'https://evil.example');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
describe('branch isolation foundation', () => {
  const principal = {
    subject: 'test-only',
    branchIds: ['sham-royal', 'sham-shaban'],
  };
  it('fails closed for anonymous, unauthorized and disabled branches', () => {
    expect(() => authorizeBranch(undefined, 'sham-royal')).toThrow();
    expect(() => authorizeBranch(principal, 'sham-aroos')).toThrow();
    expect(() => authorizeBranch(principal, 'sham-shaban')).toThrow();
    expect(
      scopedIdentity(authorizeBranch(principal, 'sham-royal'), 'record'),
    ).toEqual({ _id: 'record', branchId: 'sham-royal' });
  });
  it('validates settings without echoing secrets', () => {
    expect(() => parseEnv({ MONGODB_URI: 'secret-invalid' })).toThrow(
      'MONGODB_URI',
    );
    expect(() => parseEnv({ MONGODB_URI: 'secret-invalid' })).not.toThrow(
      'secret-invalid',
    );
  });
});
