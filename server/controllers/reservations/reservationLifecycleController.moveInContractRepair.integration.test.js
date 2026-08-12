/**
 * Integration test for the moveIn-time draft Contract repair backstop.
 *
 * The primary Contract-creation trigger is settlement
 * (reservationDepositSettlementService.js, when a reservation first becomes
 * "reserved" — see reservationDepositSettlementService.contractCreation.integration.test.js).
 * This file only covers the backstop added to the moveIn transition in
 * updateReservation: if a reservation somehow reaches moveIn without a
 * Contract (e.g. the settlement-time attempt failed and was never retried),
 * moveIn must repair it — and must NOT create a second Contract when one
 * already exists.
 */
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { MongoMemoryReplSet } from "mongodb-memory-server";

await jest.unstable_mockModule("../../config/email.js", () => ({
  sendInquiryResponseEmail: jest.fn(),
  sendReservationConfirmedEmail: jest.fn(),
  sendVisitApprovedEmail: jest.fn(),
  sendPhysicalVisitStatusEmail: jest.fn(),
  sendDocumentsRejectedEmail: jest.fn(),
  sendBillGeneratedEmail: jest.fn(),
  sendUtilityChargeAvailableEmail: jest.fn(),
  sendPaymentReminderEmail: jest.fn(),
  sendOverdueNoticeEmail: jest.fn(),
  sendPaymentApprovedEmail: jest.fn(),
  sendPaymentRejectedEmail: jest.fn(),
  sendPaymentReceiptEmail: jest.fn(),
  generateEmailVerificationEmail: jest.fn(),
  sendEmailVerificationLinkEmail: jest.fn(),
  generateLoginOtpEmail: jest.fn(),
  sendLoginOtpEmail: jest.fn(),
  normalizeOtpEmailResponse: jest.fn(),
  buildLoginOtpMessage: jest.fn(),
  classifyOtpEmailError: jest.fn(),
  default: {},
}));
await jest.unstable_mockModule("../../utils/socket.js", () => ({
  emitToUser: jest.fn(),
  emitToAdmins: jest.fn(),
  emitRoomUpdate: jest.fn(),
}));
await jest.unstable_mockModule("../../middleware/logger.js", () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
await jest.unstable_mockModule("../../utils/auditLogger.js", () => ({
  default: { log: jest.fn(), logError: jest.fn(), logModification: jest.fn() },
}));
await jest.unstable_mockModule("../../services/occupancy/occupancyManager.js", () => ({
  deriveRoomOccupancyState: jest.fn(),
  updateOccupancyOnReservationChange: jest.fn(),
  recalculateRoomOccupancy: jest.fn(),
  getRoomOccupancyStatus: jest.fn(),
  getBranchOccupancyStats: jest.fn(),
  releaseOrphanedBeds: jest.fn(),
  getDisplayStatusForReservation: jest.fn((status) => status),
  default: {},
}));

const { updateReservation } = await import("./reservationLifecycleController.js");
const { createDraftContract } = await import("../../services/contractService.js");
const { default: Reservation } = await import("../../models/Reservation.js");
const { default: Room } = await import("../../models/Room.js");
const { default: User } = await import("../../models/User.js");
const { default: Contract } = await import("../../models/Contract.js");
const { default: BusinessSettings } = await import("../../models/BusinessSettings.js");

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

const requestFor = (reservationId, body, overrides = {}) => ({
  id: "movein-contract-repair-test",
  params: { reservationId },
  body,
  adminId: new mongoose.Types.ObjectId(),
  user: { uid: "admin-firebase-uid" },
  branchFilter: undefined,
  ...overrides,
});

describe("moveIn transition — draft Contract repair backstop", () => {
  let mongo;

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri(), { dbName: "movein_contract_repair" });
    await Contract.syncIndexes();
  }, 120_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  }, 120_000);

  beforeEach(async () => {
    await Promise.all([
      Reservation.deleteMany({}),
      Room.deleteMany({}),
      User.deleteMany({}),
      Contract.deleteMany({}),
      BusinessSettings.deleteMany({}),
    ]);
    await BusinessSettings.create({
      key: "global", quadrupleDiscountPercent: 10, isDiscountEnabled: true, longTermLeaseMinMonths: 6,
    });
  });

  async function seedReservedReservation() {
    const tenant = await User.create({
      firebaseUid: `firebase-${new mongoose.Types.ObjectId()}`,
      email: `tenant-${new mongoose.Types.ObjectId()}@example.test`,
      username: `tenant_${new mongoose.Types.ObjectId().toString().slice(-10)}`,
      firstName: "Move", lastName: "InTenant", role: "applicant",
    });
    const room = await Room.create({
      name: "Room 401", roomNumber: "401", branch: "gil-puyat",
      type: "quadruple-sharing", capacity: 4, price: 6300,
    });
    // Written directly as already "reserved" — this test starts after the
    // point settlement would already have run, to isolate the moveIn repair
    // pass from settlement's own behavior (covered separately).
    const reservation = await Reservation.create({
      userId: tenant._id,
      roomId: room._id,
      status: "reserved",
      leaseDuration: 12,
      reservationFeeAmount: 2000,
      preferredRoomType: "quadruple-sharing",
      agreedToPrivacy: true,
      agreedToCertification: true,
      totalPrice: 6300,
      moveInDate: new Date("2026-09-01T00:00:00.000Z"),
      paymentStatus: "paid",
    });
    return { tenant, room, reservation };
  }

  test("moveIn repairs a missing draft Contract when settlement never created one", async () => {
    const { reservation, tenant } = await seedReservedReservation();
    expect(await Contract.countDocuments({ reservationId: reservation._id })).toBe(0);

    const req = requestFor(String(reservation._id), { status: "moveIn", meterReading: 100 });
    const res = response();
    await updateReservation(req, res, jest.fn());

    expect(res.statusCode).toBe(200);
    const contracts = await Contract.find({ reservationId: reservation._id });
    expect(contracts).toHaveLength(1);
    expect(contracts[0].status).toBe("draft");
    expect(String(contracts[0].tenantId)).toBe(String(tenant._id));
  }, 20_000); // moveIn now also attempts a real (non-fatal) Firebase claims sync

  test("moveIn does not create a second Contract when settlement already created one", async () => {
    const { reservation, tenant } = await seedReservedReservation();
    const existing = await createDraftContract({ reservationId: reservation._id, actorId: tenant._id });

    const req = requestFor(String(reservation._id), { status: "moveIn", meterReading: 100 });
    const res = response();
    await updateReservation(req, res, jest.fn());

    expect(res.statusCode).toBe(200);
    const contracts = await Contract.find({ reservationId: reservation._id });
    expect(contracts).toHaveLength(1);
    expect(String(contracts[0]._id)).toBe(String(existing._id));
  }, 20_000);
});
