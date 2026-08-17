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

describe('retired custom reset authority', () => {
  test('the general mobile auth controller cannot issue or consume custom reset credentials', () => {
    expect(authController.forgotPassword).toBeUndefined();
    expect(authController.getResetPasswordPage).toBeUndefined();
    expect(authController.resetPassword).toBeUndefined();
  });

  test('already-issued links are isolated in the explicitly transitional controller', () => {
    expect(typeof legacyPasswordResetController.getResetPasswordPage).toBe('function');
    expect(typeof legacyPasswordResetController.resetPassword).toBe('function');
    expect(legacyPasswordResetController.LEGACY_RESET_RETIREMENT_NOTE).toMatch(/No new custom reset tokens are issued/);
  });
});
