import { afterEach, describe, expect, jest, test } from '@jest/globals';
import express from 'express';

const canonicalRequest = jest.fn((req, res) => res.json({
  message: 'If an account exists for this email, a password reset link has been sent.',
  owner: 'canonical-firebase-action-code',
}));
const pass = (_req, _res, next) => next();

await jest.unstable_mockModule('../controllers/passwordResetController.js', () => ({
  requestMobileTenantPasswordReset: canonicalRequest,
}));
await jest.unstable_mockModule('../middleware/mobileSessionTeardownAuth.js', () => ({ mobileSessionTeardownAuth: pass }));
await jest.unstable_mockModule('../middleware/rateLimiter.js', () => ({ authLimiter: pass }));

const { default: mobileAuthRoutes } = await import('./mobileAuthRoutes.js');
let server;

afterEach(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  server = null;
  canonicalRequest.mockClear();
});

describe('mobile forgot-password canonical authority', () => {
  test('the bridge shadows the vendored custom-token generator', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/m', mobileAuthRoutes);
    app.post('/api/m/auth/forgot-password', (_req, res) => res.json({ owner: 'vendored-custom-token' }));
    await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });

    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/m/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'tenant@example.test' }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expect.objectContaining({ owner: 'canonical-firebase-action-code' }));
    expect(canonicalRequest).toHaveBeenCalledTimes(1);
  });
});
