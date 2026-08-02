import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const reservationFindById = jest.fn();
const stayFindOne = jest.fn();
const roomFindById = jest.fn();
const auditLog = jest.fn();
const findDbUser = jest.fn();
const workflows = {
  cancelTransferStayWorkflow: jest.fn(),
  cancelMoveOutStayWorkflow: jest.fn(),
  executeEarlyTerminationWorkflow: jest.fn(),
  executeDirectRoomSwapWorkflow: jest.fn(),
  executeAbandonmentProtocolWorkflow: jest.fn(),
};

await jest.unstable_mockModule("../../models/index.js", () => ({
  Reservation: { findById: reservationFindById },
  Stay: { findOne: stayFindOne },
  Room: { findById: roomFindById },
}));
await jest.unstable_mockModule("../../middleware/logger.js", () => ({
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));
await jest.unstable_mockModule("../../utils/auditLogger.js", () => ({
  default: { log: auditLog, logModification: jest.fn(), logError: jest.fn() },
}));
await jest.unstable_mockModule("../../utils/reservationHelpers.js", () => ({
  isValidObjectId: jest.fn(() => true),
  invalidIdResponse: jest.fn(),
  handleReservationError: (res, error) => res.status(error.statusCode || 500).json({ error: error.message, code: error.code || "ERROR" }),
  checkBranchAccess: (res, branchFilter, targetBranch) =>
    branchFilter && branchFilter !== targetBranch
      ? res.status(403).json({ error: "Access denied", code: "BRANCH_ACCESS_DENIED" })
      : null,
  syncReservationUserLifecycle: jest.fn(),
}));
await jest.unstable_mockModule("../../utils/lifecycleNaming.js", () => ({
  hasReservationStatus: jest.fn(),
  ACTIVE_STAY_STATUS_QUERY: ["moveIn"],
}));
await jest.unstable_mockModule("../../utils/occupancyManager.js", () => ({
  updateOccupancyOnReservationChange: jest.fn(),
}));
await jest.unstable_mockModule("../../utils/tenantActionService.js", () => ({
  renewStayWorkflow: jest.fn(),
  moveOutStayWorkflow: jest.fn(),
  transferStayWorkflow: jest.fn(),
  validateContractExtensionWorkflow: jest.fn(),
  ...workflows,
}));
await jest.unstable_mockModule("../../utils/reservationArchive.js", () => ({
  resolveArchivedRestoreStatus: jest.fn(),
}));
await jest.unstable_mockModule("./_helpers.js", () => ({
  POPULATE_USER: [],
  POPULATE_ROOM: [],
  findDbUser,
  serializeReservation: (value) => value,
}));

const {
  cancelTransferAction,
  cancelMoveOutAction,
  earlyTerminationAction,
  swapRoomsAction,
  triggerAbandonmentAction,
} = await import("./tenancyActionsController.js");

const ids = {
  a: "507f1f77bcf86cd799439021",
  b: "507f1f77bcf86cd799439022",
  roomA: "507f1f77bcf86cd799439023",
  roomB: "507f1f77bcf86cd799439024",
};

const fixture = (id, roomId, branch) => ({
  _id: id,
  userId: `${id}-user`,
  roomId: { _id: roomId, branch, isArchived: false, beds: [{ id: "A" }] },
  selectedBed: { id: "A" },
  pendingTransferRoomId: null,
  toObject() { return { _id: this._id, roomId: this.roomId, selectedBed: this.selectedBed }; },
});

const configureRecords = (branch, targetBranch = branch) => {
  const reservations = new Map([
    [ids.a, fixture(ids.a, ids.roomA, branch)],
    [ids.b, fixture(ids.b, ids.roomB, targetBranch)],
  ]);
  reservationFindById.mockImplementation((id) => ({
    populate: jest.fn().mockResolvedValue(reservations.get(id) || null),
  }));
  stayFindOne.mockImplementation(({ reservationId }) => {
    const reservation = reservations.get(String(reservationId));
    const stay = reservation ? {
      _id: `${reservation._id}-stay`,
      reservationId: reservation._id,
      tenantId: reservation.userId,
      branch: reservation.roomId.branch,
      roomId: reservation.roomId,
    } : null;
    return { populate: jest.fn().mockResolvedValue(stay) };
  });
  return reservations;
};

const response = () => ({
  statusCode: 200, body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});
const request = (branch, swap = false) => ({
  id: "request-2",
  params: { reservationId: ids.a },
  body: swap ? { reservationAId: ids.a, reservationBId: ids.b } : {},
  user: { uid: "firebase-admin" },
  authUser: { role: "branch_admin", branch },
  branchFilter: branch,
  isOwner: false,
});

const actionCases = [
  ["cancel transfer", cancelTransferAction, workflows.cancelTransferStayWorkflow, false],
  ["cancel move-out", cancelMoveOutAction, workflows.cancelMoveOutStayWorkflow, false],
  ["early termination", earlyTerminationAction, workflows.executeEarlyTerminationWorkflow, false],
  ["room swap", swapRoomsAction, workflows.executeDirectRoomSwapWorkflow, true],
  ["abandonment", triggerAbandonmentAction, workflows.executeAbandonmentProtocolWorkflow, false],
];
const branchPairs = [
  ["gil-puyat", "guadalupe"],
  ["guadalupe", "gil-puyat"],
];

describe("tenancy action branch isolation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auditLog.mockResolvedValue(undefined);
    findDbUser.mockResolvedValue({ _id: "507f1f77bcf86cd799439025" });
  });

  test.each(actionCases.flatMap((action) => branchPairs.map((pair) => [...action, ...pair])))
  ("%s denies %s execution on %s with zero workflow calls", async (_name, handler, workflow, swap, actorBranch, targetBranch) => {
    configureRecords(targetBranch);
    const res = response();
    await handler(request(actorBranch, swap), res, jest.fn());
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe("BRANCH_ACCESS_DENIED");
    expect(workflow).not.toHaveBeenCalled();
    expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "authorization.branch_action_denied" }));
  });

  test.each(actionCases.flatMap((action) => ["gil-puyat", "guadalupe"].map((branch) => [...action, branch])))
  ("%s preserves %s same-branch workflow execution", async (_name, handler, workflow, swap, branch) => {
    const reservations = configureRecords(branch);
    const result = swap
      ? { tenantA: reservations.get(ids.a), tenantB: reservations.get(ids.b) }
      : { reservation: reservations.get(ids.a) };
    workflow.mockResolvedValue(result);
    const res = response();
    await handler(request(branch, swap), res, jest.fn());
    expect(res.statusCode).toBe(200);
    expect(workflow).toHaveBeenCalledTimes(1);
    expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({ action: expect.not.stringContaining("denied") }));
  });

  test("cancel transfer denies an authoritative target Room in another branch", async () => {
    const reservations = configureRecords("gil-puyat");
    reservations.get(ids.a).pendingTransferRoomId = ids.roomB;
    reservations.get(ids.a).pendingTransferBedId = "A";
    roomFindById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: ids.roomB, branch: "guadalupe", isArchived: false, beds: [{ id: "A" }] }),
    });
    const res = response();
    await cancelTransferAction(request("gil-puyat"), res, jest.fn());
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe("CROSS_BRANCH_ACTION_NOT_ALLOWED");
    expect(workflows.cancelTransferStayWorkflow).not.toHaveBeenCalled();
  });

  test("room swap denies different source and target branches", async () => {
    configureRecords("gil-puyat", "guadalupe");
    const res = response();
    await swapRoomsAction(request("gil-puyat", true), res, jest.fn());
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe("CROSS_BRANCH_ACTION_NOT_ALLOWED");
    expect(workflows.executeDirectRoomSwapWorkflow).not.toHaveBeenCalled();
  });

  test("room swap fails validation when a selected Bed is outside its Room", async () => {
    const reservations = configureRecords("gil-puyat");
    reservations.get(ids.b).selectedBed = { id: "Z" };
    const res = response();
    await swapRoomsAction(request("gil-puyat", true), res, jest.fn());
    expect(res.statusCode).toBe(422);
    expect(res.body.code).toBe("TARGET_BED_MISMATCH");
    expect(workflows.executeDirectRoomSwapWorkflow).not.toHaveBeenCalled();
  });
});
