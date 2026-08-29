/**
 * Phase 2C — transferTenant controller: today vs future vs past branch.
 *
 *   effectiveTransferDate < today Manila  -> 400 PAST_TRANSFER_DATE
 *   effectiveTransferDate > today Manila  -> 201, ScheduledRoomTransfer created,
 *                                            NO physical cutover
 *   effectiveTransferDate = today / absent -> existing immediate transferStayWorkflow
 *
 * The immediate path is exercised only enough to prove it still runs (its
 * deep behavior is covered by the transfer* integration suites).
 */
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { MongoMemoryReplSet } from "mongodb-memory-server";

jest.setTimeout(240_000);

await jest.unstable_mockModule("../../utils/auditLogger.js", () => ({
  default: { log: jest.fn(), logError: jest.fn(), logModification: jest.fn() },
}));
await jest.unstable_mockModule("../../middleware/logger.js", () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
await jest.unstable_mockModule("../../utils/notificationService.js", () => ({
  notify: { general: jest.fn().mockResolvedValue(undefined) },
}));
await jest.unstable_mockModule("../../utils/occupancyManager.js", () => ({
  updateOccupancyOnReservationChange: jest.fn(),
}));

// The immediate transfer engine + the scheduling service are stubbed so this
// test isolates the CONTROLLER branch decision. (Their real behavior is
// covered by their own integration suites.)
const transferStayWorkflowMock = jest.fn(async () => ({
  reservation: { userId: new mongoose.Types.ObjectId(), toObject: () => ({}) },
  stay: {},
  fromRoomName: "Room 301",
  toRoomName: "Room 205",
  billingSnapshot: null,
}));
const scheduleRoomTransferMock = jest.fn(async ({ payload }) => ({
  scheduledTransfer: {
    _id: new mongoose.Types.ObjectId(),
    effectiveTransferDate: new Date(payload.effectiveTransferDate),
    toObject() { return { _id: this._id, effectiveTransferDate: this.effectiveTransferDate }; },
  },
}));

const realService = await import("../../utils/tenantActionService.js");
await jest.unstable_mockModule("../../utils/tenantActionService.js", () => ({
  ...realService,
  transferStayWorkflow: transferStayWorkflowMock,
}));
const realSched = await import("../../services/scheduledRoomTransferService.js");
await jest.unstable_mockModule("../../services/scheduledRoomTransferService.js", () => ({
  ...realSched,
  scheduleRoomTransfer: scheduleRoomTransferMock,
}));
const realSchedView = await import("../../services/scheduledRoomTransferView.js");
await jest.unstable_mockModule("../../services/scheduledRoomTransferView.js", () => ({
  ...realSchedView,
  serializeScheduledRoomTransfer: jest.fn(async (d) => ({ id: String(d._id), effectiveTransferDate: d.effectiveTransferDate })),
  getOpenScheduledRoomTransferForReservation: jest.fn().mockResolvedValue(null),
}));

const { transferTenant } = await import("./tenancyActionsController.js");
const { getManilaToday } = await import("../../utils/dateUtils.js");
const { Reservation, Room, User } = await import("../../models/index.js");

const response = () => ({
  statusCode: 200, body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

// A bare YYYY-MM-DD in the Manila business calendar, exactly what a
// <input type="date"> in the admin UI submits.
function dateStr(offsetDays) {
  return getManilaToday().add(offsetDays, "day").format("YYYY-MM-DD");
}

let mongo;
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri(), { dbName: "sched_transfer_2c" });
}, 120_000);
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
}, 120_000);
beforeEach(async () => {
  await Promise.all([Reservation.deleteMany({}), Room.deleteMany({}), User.deleteMany({})]);
  transferStayWorkflowMock.mockClear();
  scheduleRoomTransferMock.mockClear();
});

async function seedMovedIn() {
  const user = await User.create({
    firebaseUid: `fb-${new mongoose.Types.ObjectId()}`, email: `t-${new mongoose.Types.ObjectId()}@ex.test`,
    username: `t_${new mongoose.Types.ObjectId().toString().slice(-10)}`,
    firstName: "C", lastName: "T", role: "tenant", tenantStatus: "active",
  });
  const room = await Room.create({
    name: "Room 301", roomNumber: "301", branch: "gil-puyat",
    type: "quadruple-sharing", capacity: 4, currentOccupancy: 1, price: 5400, beds: [],
  });
  const reservation = await Reservation.create({
    userId: user._id, roomId: room._id, status: "moveIn", leaseDuration: 12,
    agreedToPrivacy: true, agreedToCertification: true,
    totalPrice: 5400, monthlyRent: 5400, moveInDate: new Date("2026-01-01"),
  });
  return { user, room, reservation };
}

function req({ reservationId, body }) {
  return {
    params: { reservationId: String(reservationId) },
    body,
    user: { uid: "admin-uid" },
    branchFilter: null,
    id: "req-1",
  };
}

describe("transferTenant — today/future/past branch", () => {
  test("PAST effective date -> 400 PAST_TRANSFER_DATE, neither path called", async () => {
    const { reservation } = await seedMovedIn();
    const res = response();
    await transferTenant(req({
      reservationId: reservation._id,
      body: { targetRoomId: String(new mongoose.Types.ObjectId()), effectiveTransferDate: dateStr(-3), confirm: true },
    }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe("PAST_TRANSFER_DATE");
    expect(transferStayWorkflowMock).not.toHaveBeenCalled();
    expect(scheduleRoomTransferMock).not.toHaveBeenCalled();
  });

  test("FUTURE effective date -> 201, scheduleRoomTransfer called, immediate engine NOT called", async () => {
    const { reservation } = await seedMovedIn();
    const res = response();
    await transferTenant(req({
      reservationId: reservation._id,
      body: { targetRoomId: String(new mongoose.Types.ObjectId()), targetBedId: "b1", effectiveTransferDate: dateStr(7), confirm: true },
    }), res);
    expect(res.statusCode).toBe(201);
    expect(res.body.message).toMatch(/scheduled/i);
    expect(res.body.scheduledRoomTransfer).toBeTruthy();
    expect(scheduleRoomTransferMock).toHaveBeenCalledTimes(1);
    expect(transferStayWorkflowMock).not.toHaveBeenCalled();
  });

  test("TODAY effective date -> immediate transferStayWorkflow, scheduler NOT called", async () => {
    const { reservation } = await seedMovedIn();
    const res = response();
    await transferTenant(req({
      reservationId: reservation._id,
      body: { targetRoomId: String(new mongoose.Types.ObjectId()), effectiveTransferDate: dateStr(0), confirm: true },
    }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/transferred/i);
    expect(transferStayWorkflowMock).toHaveBeenCalledTimes(1);
    expect(scheduleRoomTransferMock).not.toHaveBeenCalled();
  });

  test("ABSENT effective date -> immediate transferStayWorkflow", async () => {
    const { reservation } = await seedMovedIn();
    const res = response();
    await transferTenant(req({
      reservationId: reservation._id,
      body: { targetRoomId: String(new mongoose.Types.ObjectId()), confirm: true },
    }), res);
    expect(res.statusCode).toBe(200);
    expect(transferStayWorkflowMock).toHaveBeenCalledTimes(1);
    expect(scheduleRoomTransferMock).not.toHaveBeenCalled();
  });

  test("FUTURE + scheduling service throws a coded error -> that status/code is surfaced", async () => {
    const { reservation } = await seedMovedIn();
    scheduleRoomTransferMock.mockRejectedValueOnce(
      Object.assign(new Error("already scheduled"), { statusCode: 409, code: "SCHEDULED_TRANSFER_ALREADY_EXISTS" }),
    );
    const res = response();
    await transferTenant(req({
      reservationId: reservation._id,
      body: { targetRoomId: String(new mongoose.Types.ObjectId()), effectiveTransferDate: dateStr(9), confirm: true },
    }), res);
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe("SCHEDULED_TRANSFER_ALREADY_EXISTS");
    expect(transferStayWorkflowMock).not.toHaveBeenCalled();
  });
});
