/**
 * Regression test for a real production bug: the password-reset email link
 * (and the served reset page's own submit fetch) hardcoded the path
 * `/api/auth/reset-password` — a leftover from before this controller was
 * vendored into Capstone-Website as server/mobile/**, where the ENTIRE
 * mobile router tree is mounted under /api/m (server/mobile/mobileRoutes.mjs
 * -> server.js `app.use("/api/m", mobileRoutes)`). No route has ever existed
 * at the bare /api/auth/reset-password path in Capstone-Website — only
 * /api/m/auth/reset-password — so every password-reset email sent by
 * production 404'd when the tenant tapped the link.
 *
 * Confirmed live in production 2026-08-14: a real reset email's link
 * (https://api.lilycrest.space/api/auth/reset-password?token=...) returned
 * "Cannot GET /api/auth/reset-password".
 */

const mockGetDb = jest.fn();
const mockSendPasswordResetEmail = jest.fn(async () => {});

jest.mock('../config/database.js', () => ({ getDb: (...args) => mockGetDb(...args) }));
jest.mock('../config/firebase.js', () => ({
  verifyFirebaseIdToken: async () => null,
  verifyTenantInFirebase: async (email) => ({
    firebase_id: 'firebase-uid-a',
    email,
    name: 'QA Tenant',
    phone: null,
    picture: null,
  }),
  admin: { auth: () => ({}) },
}));
jest.mock('../services/emailService.js', () => ({
  sendPasswordResetEmail: (...args) => mockSendPasswordResetEmail(...args),
  sendPasswordChangedEmail: jest.fn(async () => {}),
  sendLoginOtpEmail: jest.fn(async () => {}),
  sendPaymentReceiptEmail: jest.fn(async () => {}),
}));

const authController = require('./auth.controller.js');

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function makeDb() {
  return {
    collection(name) {
      if (name === 'password_reset_tokens') {
        return {
          findOne: async () => null,
          updateMany: async () => ({ modifiedCount: 0 }),
          insertOne: async () => {},
        };
      }
      if (name === 'users') {
        return { findOne: async () => ({ user_id: 'tenant-a' }) };
      }
      if (name === 'announcements') {
        return { insertOne: async () => {} };
      }
      throw new Error(`unexpected collection: ${name}`);
    },
  };
}

describe('forgotPassword email link path', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    mockGetDb.mockReset();
    mockSendPasswordResetEmail.mockClear();
    mockGetDb.mockReturnValue(makeDb());
    process.env.NODE_ENV = 'development'; // non-production branch of passwordResetBaseUrl
    process.env.PUBLIC_API_URL = 'https://api.lilycrest.space';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('the emailed reset link points at /api/m/auth/reset-password, never the unmounted /api/auth/reset-password', async () => {
    const req = { body: { email: 'tenant@example.com' } };
    const res = response();
    await authController.forgotPassword(req, res);

    expect(res.statusCode).toBe(200);
    expect(mockSendPasswordResetEmail).toHaveBeenCalledTimes(1);
    const [, , resetLink] = mockSendPasswordResetEmail.mock.calls[0];
    expect(resetLink).toMatch(/^https:\/\/api\.lilycrest\.space\/api\/m\/auth\/reset-password\?token=/);
    expect(resetLink).not.toContain('/api/auth/reset-password');
  });
});

describe('served reset page submits to the same mounted path', () => {
  test('the reset-password page HTML fetches POST /api/m/auth/reset-password, not the unmounted /api/auth/reset-password', () => {
    const res = {
      statusCode: 200,
      send(html) { this.body = html; },
    };
    authController.getResetPasswordPage({ query: { token: 'sample-token' } }, res);
    expect(res.body).toContain("fetch('/api/m/auth/reset-password'");
    expect(res.body).not.toContain("fetch('/api/auth/reset-password'");
  });
});
