import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const state = { user: null, webSessionActive: true, mobileSessionActive: true, failRollback: false };
const setCustomUserClaims = jest.fn();
const getAuth = jest.fn(() => ({ setCustomUserClaims }));
const audit = { log: jest.fn(), logModification: jest.fn(), logDeletion: jest.fn(), logError: jest.fn() };
const invalidateUserSessions = jest.fn(async () => {
  state.user.securityVersion += 1;
  state.user.authInvalidatedAt = new Date();
  state.webSessionActive = false;
  state.mobileSessionActive = false;
  return { failures: [] };
});

const asDocument = () => ({
  ...state.user,
  permissions: state.user.permissions === undefined ? undefined : [...state.user.permissions],
  toObject() { return { ...this, permissions: this.permissions === undefined ? undefined : [...this.permissions] }; },
});

function applyUpdate(update) {
  const values = update?.$set || update;
  for (const [key, value] of Object.entries(values || {})) state.user[key] = Array.isArray(value) ? [...value] : value;
  for (const key of Object.keys(update?.$unset || {})) delete state.user[key];
}

function updateQuery(update, { rollback = false } = {}) {
  const execute = async () => {
    if (rollback && state.failRollback) throw new Error("rollback unavailable");
    applyUpdate(update);
    return asDocument();
  };
  return { select: execute, then(resolve, reject) { return execute().then(resolve, reject); } };
}

const User = {
  findOne: jest.fn(async () => asDocument()),
  findById: jest.fn(() => {
    const chain = { select: () => chain, lean: async () => ({ ...state.user, permissions: state.user.permissions === undefined ? undefined : [...state.user.permissions] }) };
    return chain;
  }),
  findByIdAndUpdate: jest.fn((id, update) => {
    const isRollback = Boolean(update?.$unset) && Object.prototype.hasOwnProperty.call(update.$set || {}, "role");
    return updateQuery(update, { rollback: isRollback });
  }),
};
const noStay = () => { const chain = { select: () => chain, lean: async () => null }; return chain; };

await jest.unstable_mockModule("../models/index.js", () => ({
  User,
  UserSession: { findValidOtpSession: jest.fn() },
  Reservation: { findOne: jest.fn(noStay) },
  Room: { find: jest.fn() },
  Bill: {}, UtilityReading: {}, MaintenanceRequest: {},
}));
await jest.unstable_mockModule("dayjs", () => ({ default: jest.fn() }));
await jest.unstable_mockModule("../config/firebase.js", () => ({ getAuth }));
await jest.unstable_mockModule("../services/sessionInvalidationService.js", () => ({ invalidateUserSessions }));
await jest.unstable_mockModule("../middleware/logger.js", () => ({ default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
await jest.unstable_mockModule("../utils/auditLogger.js", () => ({ default: audit }));
await jest.unstable_mockModule("../middleware/errorHandler.js", () => ({
  sendSuccess: jest.fn(),
  sendError: (res, message, status, code) => res.status(status).json({ error: message, code }),
  AppError: class AppError extends Error {},
}));
await jest.unstable_mockModule("../middleware/permissions.js", () => ({
  DEFAULT_PERMISSIONS: { branch_admin: ["manageUsers", "manageAnnouncements"], owner: ["manageUsers", "manageAnnouncements"] },
  ALL_PERMISSIONS: ["manageUsers", "manageAnnouncements"],
}));

const { updateUser } = await import("./usersController.js");
const { verifyAdmin } = await import("../middleware/auth.js");
const { createMobileAuth } = require("../mobile/security/mobileAuthCore.js");
const { createSession } = require("../mobile/security/mobileSession.js");

const response = () => ({ statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const request = (body) => ({
  params: { userId: "507f1f77bcf86cd799439011" }, body, branchFilter: null, isOwner: true,
  user: { uid: "actor-firebase", _id: "actor-id", role: "owner" }, headers: {},
});

async function invoke(body) {
  const res = response(); const next = jest.fn();
  await updateUser(request(body), res, next);
  return { res, next };
}

function mobileDb() {
  return { collection(name) {
    if (name === "users") return { async findOne() { return { ...state.user }; } };
    if (name === "user_sessions") return {
      async deleteMany() {},
      async insertOne(doc) { state.issuedSession = { ...doc }; },
      async findOne(query) { return state.issuedSession?.session_token === query.session_token ? { ...state.issuedSession } : null; },
    };
    if (name === "login_attempts") return { async insertOne() {} };
    throw new Error(`Unexpected collection ${name}`);
  } };
}

describe("generic updateUser access rollback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(state, {
      user: { _id: "507f1f77bcf86cd799439011", user_id: "u1", firebaseUid: "target-firebase", role: "tenant", permissions: [], branch: "branch-a", tenantStatus: "active", accountStatus: "active", isActive: true, isArchived: false, securityVersion: 4, authInvalidatedAt: null },
      webSessionActive: true, mobileSessionActive: true, failRollback: false, issuedSession: null,
    });
    setCustomUserClaims.mockRejectedValue(new Error("Firebase internal detail must stay private"));
    getAuth.mockReturnValue({ setCustomUserClaims });
  });

  test("Firebase failure restores the complete original access state and keeps sessions invalidated", async () => {
    const { res, next } = await invoke({ role: "branch_admin", permissions: ["manageUsers"], branch: "branch-b" });
    expect(res.statusCode).toBe(503); expect(res.body.code).toBe("FIREBASE_CLAIMS_SYNC_FAILED"); expect(next).not.toHaveBeenCalled();
    expect(state.user).toMatchObject({ role: "tenant", permissions: [], branch: "branch-a", tenantStatus: "active", accountStatus: "active", isActive: true, isArchived: false, securityVersion: 5 });
    expect(state.user.authInvalidatedAt).toBeInstanceOf(Date); expect(state.webSessionActive).toBe(false); expect(state.mobileSessionActive).toBe(false);
    expect(audit.logModification).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: "firebase_claims_sync_failed_rolled_back", severity: "high", metadata: expect.objectContaining({ rollbackSucceeded: true }) }));
    expect(JSON.stringify(res.body)).not.toContain("Firebase internal detail");
  });

  test("a fresh real mobile session retains tenant scope and cannot pass the mobile admin guard", async () => {
    await invoke({ role: "branch_admin", branch: "branch-b" });
    const db = mobileDb(); const issued = await createSession(db, "u1");
    const core = createMobileAuth({ getDb: () => db });
    const req = { headers: { authorization: `Bearer ${issued.session_token}` }, cookies: {} }; const res = response(); const next = jest.fn();
    await core.required(req, res, next); expect(next).toHaveBeenCalled(); expect(req.user).toMatchObject({ role: "tenant", permissions: [], branch: "branch-a" });
    core.requirePermission("manageUsers", { branchScoped: true })(req, res, next);
    expect(res.statusCode).toBe(403); expect(req.user.permissions).not.toContain("manageUsers");
  });

  test("fresh web database fallback does not grant administrative access", async () => {
    await invoke({ role: "branch_admin", branch: "branch-b" });
    const req = { user: { uid: "target-firebase" }, authUser: state.user }; const res = response(); const next = jest.fn();
    await verifyAdmin(req, res, next);
    expect(res.statusCode).toBe(403); expect(next).not.toHaveBeenCalled(); expect(state.user.role).toBe("tenant");
  });

  test("successful claims synchronization retains authoritative access and writes one success audit", async () => {
    setCustomUserClaims.mockResolvedValueOnce();
    const { res } = await invoke({ role: "branch_admin", branch: "branch-b" });
    expect(res.statusCode).toBe(200); expect(state.user).toMatchObject({ role: "branch_admin", permissions: ["manageUsers", "manageAnnouncements"], branch: "branch-b", securityVersion: 5 });
    expect(setCustomUserClaims).toHaveBeenCalledWith("target-firebase", { branch_admin: true });
    expect(audit.logModification).toHaveBeenCalledTimes(1); expect(audit.log).not.toHaveBeenCalled(); expect(invalidateUserSessions).toHaveBeenCalledTimes(1);
  });

  test("rollback failure restricts the account and records a critical reconciliation event", async () => {
    state.failRollback = true;
    const { res } = await invoke({ role: "branch_admin", branch: "branch-b" });
    expect(res.statusCode).toBe(503); expect(res.body.code).toBe("ACCESS_UPDATE_RECONCILIATION_REQUIRED");
    expect(state.user).toMatchObject({ role: "branch_admin", isActive: false, accountStatus: "suspended", securityVersion: 5 });
    expect(audit.logModification).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: "firebase_claims_sync_failed_rollback_failed", severity: "critical", metadata: expect.objectContaining({ rollbackSucceeded: false, accountRestricted: true }) }));
  });

  test("unchanged access fields do not invalidate, synchronize claims, or roll back", async () => {
    const { res } = await invoke({ role: "tenant", permissions: [], branch: "branch-a" });
    expect(res.statusCode).toBe(200); expect(invalidateUserSessions).not.toHaveBeenCalled(); expect(setCustomUserClaims).not.toHaveBeenCalled(); expect(state.user.securityVersion).toBe(4);
    expect(audit.logModification).toHaveBeenCalledTimes(1); expect(audit.log).not.toHaveBeenCalled();
  });

  test("branch-only Firebase failure restores the original branch", async () => {
    const { res } = await invoke({ branch: "branch-b" });
    expect(res.statusCode).toBe(503); expect(state.user.branch).toBe("branch-a"); expect(state.user.role).toBe("tenant"); expect(state.user.securityVersion).toBe(5);
  });

  test("unavailable Firebase claims service is treated as a failed synchronization", async () => {
    getAuth.mockReturnValueOnce(null);
    const { res } = await invoke({ role: "branch_admin", branch: "branch-b" });
    expect(res.statusCode).toBe(503); expect(res.body.code).toBe("FIREBASE_CLAIMS_SYNC_FAILED");
    expect(state.user).toMatchObject({ role: "tenant", permissions: [], branch: "branch-a", securityVersion: 5 });
    expect(audit.logModification).not.toHaveBeenCalled();
  });
});
