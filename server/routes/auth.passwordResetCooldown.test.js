import { jest } from '@jest/globals';
import express from 'express';
import http from 'http';

const pass = (_req, _res, next) => next();

await jest.unstable_mockModule('../middleware/auth.js', () => ({
  verifyToken: pass,
  verifyOnboardingToken: pass,
  verifyOwner: pass,
}));
await jest.unstable_mockModule('../middleware/rateLimiter.js', () => ({
  publicLimiter: pass,
  authLimiter: pass,
}));
await jest.unstable_mockModule('../middleware/validation.js', () => ({
  validateRegisterInput: {},
  validateProfileUpdateInput: {},
  createValidationMiddleware: () => pass,
  sanitizeName: (x) => x,
  sanitizePhone: (x) => x,
  sanitizeText: (x) => x,
}));
await jest.unstable_mockModule('../validation/validate.js', () => ({ validate: () => pass }));
await jest.unstable_mockModule('../validation/schemas.js', () => ({ setRoleSchema: {}, updateBranchSchema: {} }));
await jest.unstable_mockModule('../config/firebase.js', () => ({ getAuth: () => ({}) }));
await jest.unstable_mockModule('../utils/auditLogger.js', () => ({ default: { log: jest.fn() } }));
await jest.unstable_mockModule('../models/index.js', () => ({
  User: { updateOne: jest.fn().mockResolvedValue({}) },
  UserSession: {},
  LoginLog: {},
  Reservation: {},
  Stay: {},
}));

const { logPasswordReset } = await import('../controllers/authController.js');

describe('Server-side password reset cooldown', () => {
  async function callEndpoint(body) {
    const app = express();
    app.use(express.json());
    app.post('/api/auth/log-password-reset', logPasswordReset);
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/log-password-reset`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      return { status: response.status, body: await response.json() };
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  }

  test('subsequent reset request for same email within 30s is rejected with 429 PASSWORD_RESET_COOLDOWN', async () => {
    const testEmail = `cooldowntest_${Date.now()}@example.com`;
    const res1 = await callEndpoint({ email: testEmail, success: true });
    expect(res1.status).toBe(200);
    expect(res1.body.cooldownSeconds).toBe(30);

    const res2 = await callEndpoint({ email: testEmail, checkOnly: true });
    expect(res2.status).toBe(429);
    expect(res2.body.code).toBe('PASSWORD_RESET_COOLDOWN');
    expect(res2.body.retryAfterSeconds).toBeGreaterThan(0);
    expect(res2.body.retryAfterSeconds).toBeLessThanOrEqual(30);
  });
});
