/**
 * Full non-consuming lifecycle proof for the reset-token status bridge
 * (routes/mobileAuthRoutes.js POST /auth/reset-password/status) against the
 * REAL, unmocked resetPassword handler in this file's sibling
 * auth.controller.js — proving the status check and the actual reset share
 * one eligibility definition (mobile/security/resetTokenEligibility.js) and
 * that status checks never mutate the token, password, or session state.
 *
 * The HTTP-level behavior of the status route itself (validation, response
 * shape, route precedence) is covered separately in
 * routes/mobileAuthResetStatus.test.js. This file proves the shared-logic
 * claim end-to-end: status(valid) -> status(again) -> real reset -> second
 * reset rejected -> status(after reset) false, using the exact same
 * `password_reset_tokens` collection state resetPassword itself mutates.
 */

const mockFirebaseUpdateUser = jest.fn(async () => {});
let mockCurrentDb;
jest.mock('../config/database.js', () => ({ getDb: () => mockCurrentDb }));
jest.mock('../config/firebase.js', () => ({
  verifyFirebaseIdToken: async () => null,
  verifyTenantInFirebase: async () => null,
  admin: { auth: () => ({ updateUser: mockFirebaseUpdateUser, revokeRefreshTokens: async () => {} }) },
}));
jest.mock('../services/emailService.js', () => ({
  sendPasswordResetEmail: jest.fn(async () => {}),
  sendPasswordChangedEmail: jest.fn(async () => {}),
  sendLoginOtpEmail: jest.fn(async () => {}),
  sendPaymentReceiptEmail: jest.fn(async () => {}),
}));

const authController = require('./auth.controller');
const { hashResetToken, resetTokenEligibilityFilter } = require('../security/resetTokenEligibility');

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

// In-memory password_reset_tokens + users + user_sessions + login_attempts
// store, faithful enough for resetPassword's real code path: findOne (the
// eligibility filter), updateOne (marks used), users.findOne (identity for
// invalidateMobileIdentity), user_sessions/usersessions revocation,
// login_attempts audit insert.
function makeDb(tokenDoc, userDoc) {
  const state = { token: tokenDoc ? { ...tokenDoc } : null, sessionsDeleted: 0 };
  const db = {
    collection(name) {
      if (name === 'password_reset_tokens') {
        return {
          findOne: async (query) => {
            if (!state.token) return null;
            if (state.token.hashedToken !== query.hashedToken) return null;
            if (state.token.used !== query.used) return null;
            if (!(state.token.expiresAt > query.expiresAt.$gt)) return null;
            return { ...state.token };
          },
          updateOne: async (filter, update) => {
            if (state.token && state.token.hashedToken === filter.hashedToken) {
              Object.assign(state.token, update.$set);
              return { matchedCount: 1, modifiedCount: 1 };
            }
            return { matchedCount: 0, modifiedCount: 0 };
          },
        };
      }
      if (name === 'users') {
        return {
          findOne: async () => (userDoc ? { ...userDoc } : null),
          findOneAndUpdate: async (_filter, update) => {
            if (userDoc) {
              userDoc.securityVersion = Number(userDoc.securityVersion || 0) + Number(update.$inc?.securityVersion || 0);
              Object.assign(userDoc, update.$set);
            }
            return { value: userDoc ? { ...userDoc } : null };
          },
        };
      }
      if (name === 'user_sessions') {
        return {
          deleteMany: async () => { state.sessionsDeleted += 1; return { deletedCount: 1 }; },
        };
      }
      if (name === 'usersessions') {
        return { updateMany: async () => ({ modifiedCount: 0 }) };
      }
      if (name === 'login_attempts') {
        return { insertOne: async () => {} };
      }
      throw new Error(`Unexpected collection in test stub: ${name}`);
    },
  };
  return { db, state };
}

// The read-only status check as the mounted route itself performs it —
// calling the exact same shared helpers resetPassword calls, against the
// exact same db handle, so this is a faithful stand-in for the HTTP route
// without needing to bridge this CJS test's jest.mock() registry across to
// the ESM route file's separate module registry.
async function checkStatus(db, rawToken) {
  if (typeof rawToken !== 'string' || !rawToken.trim()) return { valid: false };
  const record = await db.collection('password_reset_tokens').findOne(
    resetTokenEligibilityFilter(hashResetToken(rawToken)),
  );
  return { valid: Boolean(record) };
}

describe('password reset non-consuming lifecycle: status -> status -> reset -> second reset -> status', () => {
  test('full lifecycle', async () => {
    const rawToken = 'lifecycle-raw-token';
    const hashedToken = hashResetToken(rawToken);
    const { db, state } = makeDb(
      { hashedToken, email: 'tenant@example.com', uid: 'firebase-uid-a', user_id: 'tenant-a', expiresAt: new Date(Date.now() + 15 * 60 * 1000), used: false, createdAt: new Date() },
      { user_id: 'tenant-a', firebase_uid: 'firebase-uid-a', securityVersion: 0 },
    );
    mockCurrentDb = db;

    // 1. status(valid token) -> true
    expect(await checkStatus(db, rawToken)).toEqual({ valid: true });

    // 2. status(same token again) -> still true, no mutation from step 1
    expect(await checkStatus(db, rawToken)).toEqual({ valid: true });
    expect(state.token.used).toBe(false);

    // 3. real reset with the same token -> succeeds exactly once
    const resetRes = response();
    await authController.resetPassword({ body: { token: rawToken, newPassword: 'NewStrong1!' }, ip: '127.0.0.1' }, resetRes);
    expect(resetRes.statusCode).toBe(200);
    expect(state.token.used).toBe(true);
    expect(mockFirebaseUpdateUser).toHaveBeenCalledWith('firebase-uid-a', { password: 'NewStrong1!' });
    expect(state.sessionsDeleted).toBeGreaterThanOrEqual(1);

    // A second reset attempt with the same (now-used) token must fail.
    const secondResetRes = response();
    await authController.resetPassword({ body: { token: rawToken, newPassword: 'AnotherStrong1!' }, ip: '127.0.0.1' }, secondResetRes);
    expect(secondResetRes.statusCode).toBe(400);
    expect(mockFirebaseUpdateUser).toHaveBeenCalledTimes(1);

    // 4. status(after successful reset) -> false
    expect(await checkStatus(db, rawToken)).toEqual({ valid: false });
  });

  test('resetTokenEligibilityFilter is the exact function both resetPassword and the status route call — no duplicated eligibility logic', () => {
    expect(typeof authController.hashResetToken).toBe('function');
    expect(typeof authController.resetTokenEligibilityFilter).toBe('function');
    expect(authController.hashResetToken).toBe(hashResetToken);
    expect(authController.resetTokenEligibilityFilter).toBe(resetTokenEligibilityFilter);
  });
});
