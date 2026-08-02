import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const reservationFindById = jest.fn();
const findDbUser = jest.fn();
const syncReservationUserLifecycle = jest.fn();
const updateOccupancyOnReservationChange = jest.fn();
const auditLog = jest.fn();
const notifications = {
  cancellationApproved: jest.fn(),
  cancellationRejected: jest.fn(),
  cancellationRequested: jest.fn(),
};

await jest.unstable_mockModule("../../models/index.js", () => ({
  Reservation: { findById: reservationFindById },
}));
await jest.unstable_mockModule("../../middleware/logger.js", () => ({
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));
await jest.unstable_mockModule("../../utils/auditLogger.js", () => ({
  default: { log: auditLog, logModification: jest.fn() },
}));
await jest.unstable_mockModule("../../utils/reservationHelpers.js", () => ({
  isValidObjectId: jest.fn(() => true),
  invalidIdResponse: jest.fn(),
  syncReservationUserLifecycle,
  checkBranchAccess: (res, branchFilter, targetBranch) =>
    branchFilter && branchFilter !== targetBranch
      ? res.status(403).json({ error: "Access denied", code: "BRANCH_ACCESS_DENIED" })
      : null,
}));
await jest.unstable_mockModule("../../utils/lifecycleNaming.js", () => ({
  normalizeReservationStatus: (status) => status,
}));
await jest.unstable_mockModule("../../utils/occupancyManager.js", () => ({
  updateOccupancyOnReservationChange,
}));
await jest.unstable_mockModule("../../utils/notificationService.js", () => ({
  notify: notifications,
}));
await jest.unstable_mockModule("./_helpers.js", () => ({
  findDbUser,
  notifyAdminsOfCancellationRequest: jest.fn(),
}));

const {
  approveCancellationRequest,
  rejectCancellationRequest,
  approvePreMoveInModification,
  rejectPreMoveInModification,
} = await import("./cancellationController.js");

const makeReservation = (branch) => {
  const reservation = {
    _id: "507f1f77bcf86cd799439011",
    userId: "507f1f77bcf86cd799439012",
    roomId: { _id: "507f1f77bcf86cd799439013", branch, isArchived: false },
    status: "reserved",
    cancellationRequested: true,
    cancellationStatus: "pending",
    modificationRequested: true,
    modificationStatus: "pending",
    modificationDetails: { requestedMoveInDate: new Date("2026-09-01") },
    visitHistory: [],
    save: jest.fn(async function save() { return this; }),
    toObject() {
      return { _id: this._id, status: this.status, roomId: this.roomId, cancellationStatus: this.cancellationStatus, modificationStatus: this.modificationStatus };
    },
  };
  reservationFindById.mockReturnValue({
    populate: jest.fn().mockResolvedValue(reservation),
  });
  return reservation;
};

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});
const request = (branch) => ({
  id: "request-1",
  params: { reservationId: "507f1f77bcf86cd799439011" },
  body: { note: "Reviewed" },
  user: { uid: "firebase-admin" },
  authUser: { role: "branch_admin", branch },
  branchFilter: branch,
  isOwner: false,
});

const actions = [
  ["approve cancellation", approveCancellationRequest],
  ["reject cancellation", rejectCancellationRequest],
  ["approve pre-move-in modification", approvePreMoveInModification],
  ["reject pre-move-in modification", rejectPreMoveInModification],
];
const branchPairs = [
  ["gil-puyat", "guadalupe"],
  ["guadalupe", "gil-puyat"],
];

describe("cancellation and modification branch isolation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findDbUser.mockResolvedValue({ _id: "507f1f77bcf86cd799439014" });
    auditLog.mockResolvedValue(undefined);
    syncReservationUserLifecycle.mockResolvedValue(undefined);
    updateOccupancyOnReservationChange.mockResolvedValue(undefined);
    Object.values(notifications).forEach((mock) => mock.mockResolvedValue(undefined));
  });

  test.each(actions.flatMap((action) => branchPairs.map((pair) => [...action, ...pair])))
  ("%s denies %s access to %s before side effects", async (_name, handler, actorBranch, targetBranch) => {
    const reservation = makeReservation(targetBranch);
    const res = response();
    await handler(request(actorBranch), res, jest.fn());
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe("BRANCH_ACCESS_DENIED");
    expect(reservation.save).not.toHaveBeenCalled();
    expect(updateOccupancyOnReservationChange).not.toHaveBeenCalled();
    expect(syncReservationUserLifecycle).not.toHaveBeenCalled();
    expect(Object.values(notifications).every((mock) => mock.mock.calls.length === 0)).toBe(true);
    expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "authorization.branch_action_denied" }));
  });

  test.each(actions.flatMap((action) => ["gil-puyat", "guadalupe"].map((branch) => [...action, branch])))
  ("%s preserves authorized same-branch behavior for %s", async (_name, handler, branch) => {
    const reservation = makeReservation(branch);
    const res = response();
    await handler(request(branch), res, jest.fn());
    expect(res.statusCode).toBe(200);
    expect(reservation.save).toHaveBeenCalledTimes(1);
    expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: expect.not.stringContaining("denied"),
    }));
  });
});
