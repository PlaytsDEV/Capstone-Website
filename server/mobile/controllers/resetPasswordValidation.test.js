jest.mock('../config/database.js', () => ({ getDb: () => ({}) }));
jest.mock('../config/firebase.js', () => ({ admin: { apps: [] } }));

const { __test } = require('./auth.controller.js');
const { validateNewPassword } = __test;

// Mirrors frontend/src/utils/passwordValidation.js's getStrongPasswordChecks —
// the reset-password page's live checklist shows all six of these, so the
// server must enforce all six too, not just a subset. A client-only rule is
// trivially bypassed by calling POST /api/m/auth/reset-password directly.
describe('validateNewPassword — strict server-side enforcement', () => {
  test('a password missing every requirement reports every failure, not just the first', () => {
    const errors = validateNewPassword('short');
    expect(errors).toEqual(expect.arrayContaining([
      expect.stringContaining('8 characters'),
      expect.stringContaining('uppercase'),
      expect.stringContaining('number'),
      expect.stringContaining('special character'),
    ]));
  });

  test('rejects a password containing spaces even when otherwise strong', () => {
    const errors = validateNewPassword('Strong Pass1!');
    expect(errors).toContain('Password must not contain spaces');
  });

  test('rejects a password with no uppercase letter', () => {
    expect(validateNewPassword('lowercase1!')).toContain('Password must contain at least one uppercase letter');
  });

  test('rejects a password with no lowercase letter', () => {
    expect(validateNewPassword('UPPERCASE1!')).toContain('Password must contain at least one lowercase letter');
  });

  test('rejects a password with no number', () => {
    expect(validateNewPassword('NoNumbers!')).toContain('Password must contain at least one number');
  });

  test('rejects a password with no special character', () => {
    expect(validateNewPassword('NoSpecial1')).toContain('Password must contain at least one special character (e.g. !@#$%^&*)');
  });

  test('rejects a password over 128 characters', () => {
    const tooLong = 'Aa1!' + 'x'.repeat(126);
    expect(validateNewPassword(tooLong)).toContain('Password must be 128 characters or fewer');
  });

  test('flags a known common password, in addition to any composition failures', () => {
    expect(validateNewPassword('password123')).toContain('This password is too common. Please choose a stronger one');
  });

  test('accepts a password that meets every requirement', () => {
    expect(validateNewPassword('Str0ng!Passw0rd')).toEqual([]);
  });

  test('rejects an empty or non-string password without throwing', () => {
    expect(validateNewPassword('')).toEqual(['New password is required']);
    expect(validateNewPassword(undefined)).toEqual(['New password is required']);
  });
});
