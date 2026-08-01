import { jest } from '@jest/globals';
const findById = jest.fn(); const setCustomUserClaims = jest.fn(); const invalidateUserSessions = jest.fn();
await jest.unstable_mockModule('../models/index.js', () => ({ User: { findById }, LoginLog: {}, Reservation: {}, Stay: {}, UserSession: {} }));
await jest.unstable_mockModule('../config/firebase.js', () => ({ getAuth: () => ({ setCustomUserClaims }) }));
await jest.unstable_mockModule('../config/email.js', () => ({ sendLoginOtpEmail: jest.fn() }));
await jest.unstable_mockModule('../middleware/errorHandler.js', () => ({ AppError: class AppError extends Error {} }));
await jest.unstable_mockModule('../middleware/logger.js', () => ({ default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
await jest.unstable_mockModule('../middleware/validation.js', () => ({ sanitizeName: (v) => v, sanitizePhone: (v) => v, sanitizeText: (v) => v }));
await jest.unstable_mockModule('../utils/auditLogger.js', () => ({ default: { log: jest.fn() } }));
await jest.unstable_mockModule('../services/sessionInvalidationService.js', () => ({ invalidateUserSessions }));
await jest.unstable_mockModule('../services/tenantProfileService.js', () => ({ resolveTenantOccupancyDetails: jest.fn(), resolveTenantPersonalDetails: jest.fn() }));
const { setRole } = await import('./authController.js');
const response = () => ({ statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(v) { this.body = v; return this; } });
const req = () => ({ body: { userId: '507f1f77bcf86cd799439011', role: 'branch_admin' }, headers: {} });

describe('setRole fail-closed access mutation', () => {
  beforeEach(() => { jest.clearAllMocks(); invalidateUserSessions.mockResolvedValue({ failures: [] }); });
  test('logical invalidation failure leaves role and permissions unchanged', async () => {
    const user = { _id: 'm1', user_id: 'u1', firebaseUid: 'f1', email: 'u@example.test', role: 'tenant', permissions: [], save: jest.fn() }; findById.mockResolvedValue(user);
    invalidateUserSessions.mockRejectedValueOnce(Object.assign(new Error('version failed'), { code: 'SESSION_INVALIDATION_FAILED' })); const next = jest.fn();
    await setRole(req(), response(), next);
    expect(user.role).toBe('tenant'); expect(user.permissions).toEqual([]); expect(user.save).not.toHaveBeenCalled(); expect(setCustomUserClaims).not.toHaveBeenCalled(); expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'SESSION_INVALIDATION_FAILED' }));
  });
  test('successful elevation invalidates exactly once before role save with correct reason', async () => {
    const order = []; const user = { _id: 'm1', user_id: 'u1', firebaseUid: 'f1', email: 'u@example.test', role: 'tenant', permissions: [], save: jest.fn(async () => order.push('save')) }; findById.mockResolvedValue(user);
    invalidateUserSessions.mockImplementationOnce(async ({ reason }) => { order.push(`invalidate:${reason}`); return { failures: [] }; }); setCustomUserClaims.mockImplementation(async () => order.push('claims')); const res = response();
    await setRole(req(), res, jest.fn());
    expect(order).toEqual(['invalidate:role_changed', 'save', 'claims']); expect(invalidateUserSessions).toHaveBeenCalledTimes(1); expect(user.role).toBe('branch_admin'); expect(res.body.sessionCleanupComplete).toBe(true);
  });
  test('partial physical cleanup keeps elevation logically safe and is reported', async () => {
    const user = { _id: 'm1', user_id: 'u1', firebaseUid: 'f1', email: 'u@example.test', role: 'tenant', permissions: [], save: jest.fn() }; findById.mockResolvedValue(user); invalidateUserSessions.mockResolvedValueOnce({ failures: [{ store: 'mobile' }] }); const res = response();
    await setRole(req(), res, jest.fn()); expect(user.role).toBe('branch_admin'); expect(res.body.sessionCleanupComplete).toBe(false); expect(invalidateUserSessions).toHaveBeenCalledTimes(1);
  });
});
