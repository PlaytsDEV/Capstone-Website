jest.mock('../config/database.js', () => ({ getDb: jest.fn() }));
jest.mock('../config/firebase.js', () => ({
  verifyFirebaseIdToken: jest.fn(),
  verifyTenantInFirebase: jest.fn(),
  admin: { auth: () => ({}) },
}));
jest.mock('../services/emailService.js', () => ({
  sendPasswordResetEmail: jest.fn(),
  sendPasswordChangedEmail: jest.fn(),
}));

const authController = require('./auth.controller.js');
const legacyPasswordResetController = require('./legacyPasswordReset.controller.js');
const { resetTokenEligibilityFilter } = require('../security/resetTokenEligibility');

describe('transitional reset isolation', () => {
  test('normal auth exports contain no custom-token reset authority', () => {
    expect(authController.forgotPassword).toBeUndefined();
    expect(authController.resetPassword).toBeUndefined();
  });

  test('legacy reset remains isolated and a processing claim is ineligible for status/reuse', () => {
    expect(typeof legacyPasswordResetController.resetPassword).toBe('function');
    expect(resetTokenEligibilityFilter('hash', new Date('2026-01-01T00:00:00.000Z'))).toEqual({
      hashedToken: 'hash',
      used: false,
      expiresAt: { $gt: new Date('2026-01-01T00:00:00.000Z') },
      processingId: { $exists: false },
    });
  });
});
