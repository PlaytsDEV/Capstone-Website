const fs = require('fs');
const path = require('path');

const mockUpdateUser = jest.fn();
const mockRevokeRefreshTokens = jest.fn(async () => {});
const mockSendPasswordChangedEmail = jest.fn(async () => {});
let mockCurrentDb;

jest.mock('../config/database.js', () => ({ getDb: () => mockCurrentDb }));
jest.mock('../config/firebase.js', () => ({
  admin: { auth: () => ({ updateUser: mockUpdateUser, revokeRefreshTokens: mockRevokeRefreshTokens }) },
}));
jest.mock('../services/emailService.js', () => ({ sendPasswordChangedEmail: mockSendPasswordChangedEmail }));

const controller = require('./legacyPasswordReset.controller');
const { hashResetToken } = require('../security/resetTokenEligibility');

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function database(rawToken = 'legacy-token') {
  const state = {
    token: {
      hashedToken: hashResetToken(rawToken),
      email: 'tenant@example.test',
      uid: 'firebase-1',
      user_id: 'tenant-1',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      used: false,
    },
    claimed: false,
    order: [],
    user: {
      _id: 'mongo-1',
      user_id: 'tenant-1',
      firebase_uid: 'firebase-1',
      role: 'tenant',
      accountStatus: 'active',
      tenantStatus: 'active',
      securityVersion: 0,
    },
  };
  const db = { collection(name) {
    if (name === 'password_reset_tokens') return {
      async findOneAndUpdate(filter, update) {
        if (state.claimed || state.token.used || state.token.hashedToken !== filter.hashedToken) return null;
        state.claimed = true;
        Object.assign(state.token, update.$set);
        state.order.push('claim');
        return { ...state.token };
      },
      async updateOne(filter, update) {
        if (filter.processingId && filter.processingId !== state.token.processingId) return { matchedCount: 0 };
        if (update.$set?.used) state.order.push('consume');
        if (update.$set) Object.assign(state.token, update.$set);
        if (update.$unset) Object.keys(update.$unset).forEach((key) => delete state.token[key]);
        if (!state.token.processingId) state.claimed = false;
        return { matchedCount: 1, modifiedCount: 1 };
      },
    };
    if (name === 'users') return {
      async findOne() { return { ...state.user }; },
      async findOneAndUpdate() { return { user_id: 'tenant-1', securityVersion: 1 }; },
    };
    if (name === 'user_sessions') return { async deleteMany() { return { deletedCount: 1 }; } };
    if (name === 'usersessions') return { async updateMany() { return { modifiedCount: 1 }; } };
    throw new Error(`Unexpected collection: ${name}`);
  } };
  return { db, state };
}

describe('legacy reset compatibility controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const fixture = database();
    mockCurrentDb = fixture.db;
    controller.__fixture = fixture;
    mockUpdateUser.mockImplementation(async () => { fixture.state.order.push('firebase-update'); });
  });

  test('claims once, updates Firebase, then consumes the token and finalizes sessions', async () => {
    const res = response();
    await controller.resetPassword({ body: { token: 'legacy-token', newPassword: 'StrongPass1!' } }, res);
    expect(res.statusCode).toBe(200);
    expect(controller.__fixture.state.order.slice(0, 3)).toEqual(['claim', 'firebase-update', 'consume']);
    expect(controller.__fixture.state.token.used).toBe(true);
    expect(mockUpdateUser).toHaveBeenCalledWith('firebase-1', { password: 'StrongPass1!' });
    expect(res.body.sessionCleanupComplete).toBe(true);
  });

  test('a concurrent second request cannot pass the processing claim', async () => {
    let releaseUpdate;
    mockUpdateUser.mockImplementation(() => new Promise((resolve) => { releaseUpdate = resolve; }));
    const first = response();
    const firstPromise = controller.resetPassword({ body: { token: 'legacy-token', newPassword: 'StrongPass1!' } }, first);
    await Promise.resolve();
    const second = response();
    await controller.resetPassword({ body: { token: 'legacy-token', newPassword: 'OtherStrong2!' } }, second);
    expect(second.statusCode).toBe(400);
    releaseUpdate();
    await firstPromise;
    expect(mockUpdateUser).toHaveBeenCalledTimes(1);
  });

  test('provider failure releases the claim without consuming the token', async () => {
    mockUpdateUser.mockRejectedValueOnce(Object.assign(new Error('provider unavailable'), { code: 'auth/internal-error' }));
    const res = response();
    await controller.resetPassword({ body: { token: 'legacy-token', newPassword: 'StrongPass1!' } }, res);
    expect(res.statusCode).toBe(502);
    expect(controller.__fixture.state.token.used).toBe(false);
    expect(controller.__fixture.state.token.processingId).toBeUndefined();
  });

  test.each(['applicant', 'admin', 'branch_admin', 'owner', 'staff'])(
    'a legacy token for %s cannot update Firebase',
    async (role) => {
      controller.__fixture.state.user.role = role;
      const res = response();
      await controller.resetPassword({ body: { token: 'legacy-token', newPassword: 'StrongPass1!' } }, res);
      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('RESET_LINK_INVALID');
      expect(mockUpdateUser).not.toHaveBeenCalled();
      expect(controller.__fixture.state.token.used).toBe(true);
    },
  );

  test('the compatibility page has no inline script or event-handler attributes', () => {
    const res = { type: jest.fn(() => res), send: jest.fn() };
    controller.getResetPasswordPage({}, res);
    const html = res.send.mock.calls[0][0];
    expect(html).toContain('<script src="/api/m/auth/reset-password/legacy.js" defer></script>');
    expect(html).not.toMatch(/<script(?![^>]+src=)[^>]*>/i);
    expect(html).not.toMatch(/\sonclick=/i);
    expect(html).toContain('id="reset-form" class="hidden"');
    expect(html.match(/<button class="eye"[^>]* disabled>/g)).toHaveLength(2);
  });

  test('the external compatibility script parses and verifies status before enabling the form', () => {
    const script = fs.readFileSync(path.join(__dirname, '..', 'public', 'legacy-password-reset.js'), 'utf8');
    expect(() => new Function(script)).not.toThrow();
    expect(script).toContain("fetch('/api/m/auth/reset-password/status'");
    expect(script).toContain('setPasswordControlsEnabled(false)');
    expect(script.indexOf('setPasswordControlsEnabled(false)')).toBeLessThan(script.indexOf('setPasswordControlsEnabled(true)'));
    expect(script).toContain('button.disabled = !enabled');
  });
});
