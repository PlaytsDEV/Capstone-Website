/**
 * Integration test for the reservation-approval controller's structured
 * pricing-snapshot idempotency guard (updateReservation, status transition
 * to "approved_for_payment"), using a real in-memory MongoDB so the actual
 * transition logic (not just the resolver in isolation) is exercised:
 *   - first approval succeeds with the correct 5400/8800 output and creates
 *     exactly one pricing snapshot
 *   - a repeated approval call does not recompute/overwrite it
 *   - a pricing-resolution failure (missing lease duration) returns a
 *     structured 422 and does not partially advance the reservation status
 *   - a client-submitted fake monthly rate is ignored — the server value wins
 */
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { MongoMemoryServer } from "mongodb-memory-server";

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
  default: {},
}));

const { updateReservation } = await import("./reservationLifecycleController.js");
const { default: Reservation } = await import("../../models/Reservation.js");
const { default: Room } = await import("../../models/Room.js");
const { default: BusinessSettings } = await import("../../models/BusinessSettings.js");

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

const requestFor = (reservationId, body, overrides = {}) => ({
  id: "approval-idempotency-test",
  params: { reservationId },
  body,
  adminId: new mongoose.Types.ObjectId(),
  user: { uid: "admin-firebase-uid" },
  branchFilter: undefined,
  ...overrides,
});

describe("reservation approval — structured pricing snapshot idempotency", () => {
  let mongo;

  beforeAll(async () => {
    process.env.STRUCTURED_INITIAL_PAYMENT_ENABLED = "true";
    delete process.env.STRUCTURED_INITIAL_PAYMENT_EFFECTIVE_AT;
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri(), { dbName: "approval_pricing_idempotency" });
  }, 120_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  beforeEach(async () => {
    await Reservation.deleteMany({});
    await Room.deleteMany({});
    await BusinessSettings.deleteMany({});
    await BusinessSettings.create({
      key: "global",
      quadrupleDiscountPercent: 10,
      isDiscountEnabled: true,
      longTermLeaseMinMonths: 6,
    });
  });

  async function createRoomAndReservation({ leaseDuration = 12 } = {}) {
    const room = await Room.create({
      name: "Room 201",
      roomNumber: "201",
      branch: "gil-puyat",
      type: "quadruple-sharing",
      capacity: 4,
      price: 6300,
      monthlyPrice: null, // real-world case: not pre-populated, matches investigation
    });
    const reservation = await Reservation.create({
      userId: new mongoose.Types.ObjectId(),
      roomId: room._id,
      status: "pending_application_review",
      leaseDuration,
      reservationFeeAmount: 2000,
      preferredRoomType: "quadruple-sharing",
      agreedToPrivacy: true,
      agreedToCertification: true,
      totalPrice: 6300,
      moveInDate: new Date("2026-09-01T00:00:00.000Z"),
    });
    return { room, reservation };
  }

  test("first approval succeeds with 5400/8800 and creates exactly one snapshot", async () => {
    const { reservation } = await createRoomAndReservation({ leaseDuration: 12 });
    const req = requestFor(String(reservation._id), { status: "approved_for_payment" });
    const res = response();

    await updateReservation(req, res, jest.fn());

    expect(res.statusCode).toBe(200);
    const updated = await Reservation.findById(reservation._id).lean();
    expect(updated.financialWorkflowVersion).toBe("structured-initial-payment-v1");
    expect(updated.pricingSnapshot.regularMonthlyRate).toBe(6000);
    expect(updated.pricingSnapshot.finalMonthlyRate).toBe(5400);
    expect(updated.pricingSnapshot.advanceRentAmount).toBe(5400);
    expect(updated.pricingSnapshot.securityDepositAmount).toBe(5400);
    // advance(5400) + deposit(5400) - reservationFeeCredit(2000) = 8800
    const initialPaymentTotal =
      updated.pricingSnapshot.advanceRentAmount +
      updated.pricingSnapshot.securityDepositAmount -
      updated.pricingSnapshot.reservationFeeAmount;
    expect(initialPaymentTotal).toBe(8800);
    expect(updated.pricingSnapshotVersion).toBe(1);
  });

  test("5-month lease approval resolves to 6300/10600", async () => {
    const { reservation } = await createRoomAndReservation({ leaseDuration: 5 });
    const req = requestFor(String(reservation._id), { status: "approved_for_payment" });
    const res = response();

    await updateReservation(req, res, jest.fn());

    expect(res.statusCode).toBe(200);
    const updated = await Reservation.findById(reservation._id).lean();
    expect(updated.pricingSnapshot.regularMonthlyRate).toBe(7000);
    expect(updated.pricingSnapshot.finalMonthlyRate).toBe(6300);
    const initialPaymentTotal =
      updated.pricingSnapshot.advanceRentAmount +
      updated.pricingSnapshot.securityDepositAmount -
      updated.pricingSnapshot.reservationFeeAmount;
    expect(initialPaymentTotal).toBe(10600);
  });

  test("a repeated approval call does not recompute or overwrite the snapshot", async () => {
    const { reservation } = await createRoomAndReservation({ leaseDuration: 12 });
    const firstReq = requestFor(String(reservation._id), { status: "approved_for_payment" });
    await updateReservation(firstReq, response(), jest.fn());

    const afterFirst = await Reservation.findById(reservation._id).lean();
    expect(afterFirst.pricingSnapshot.finalMonthlyRate).toBe(5400);
    const firstApprovedAt = new Date(afterFirst.pricingSnapshot.approvedAt).getTime();

    // Repeat the same approval call against the now-approved reservation.
    const secondReq = requestFor(String(reservation._id), { status: "approved_for_payment" });
    const secondRes = response();
    await updateReservation(secondReq, secondRes, jest.fn());

    expect(secondRes.statusCode).toBe(200);
    const afterSecond = await Reservation.findById(reservation._id).lean();
    expect(afterSecond.pricingSnapshot.finalMonthlyRate).toBe(5400);
    expect(afterSecond.pricingSnapshotVersion).toBe(1);
    expect(new Date(afterSecond.pricingSnapshot.approvedAt).getTime()).toBe(firstApprovedAt);
  });

  test("pricing-resolution failure (missing lease duration) returns structured 422, creates no snapshot, does not advance status", async () => {
    const room = await Room.create({
      name: "Room 202",
      roomNumber: "202",
      branch: "gil-puyat",
      type: "quadruple-sharing",
      capacity: 4,
      price: 6300,
    });
    const reservation = await Reservation.create({
      userId: new mongoose.Types.ObjectId(),
      roomId: room._id,
      status: "pending_application_review",
      // leaseDuration intentionally omitted
      reservationFeeAmount: 2000,
      preferredRoomType: "quadruple-sharing",
      totalPrice: 6300,
      moveInDate: new Date("2026-09-01T00:00:00.000Z"),
    });
    const req = requestFor(String(reservation._id), { status: "approved_for_payment" });
    const res = response();

    await updateReservation(req, res, jest.fn());

    expect(res.statusCode).toBe(422);
    expect(res.body.code).toBe("LEASE_DURATION_INVALID");
    const unchanged = await Reservation.findById(reservation._id).lean();
    expect(unchanged.status).toBe("pending_application_review");
    expect(unchanged.financialWorkflowVersion).toBeFalsy();
    expect(unchanged.pricingSnapshot?.approvedAt).toBeFalsy();
  });

  test("a client-submitted fake monthly rate/pricing payload is ignored — server value wins", async () => {
    const { reservation } = await createRoomAndReservation({ leaseDuration: 12 });
    const req = requestFor(String(reservation._id), {
      status: "approved_for_payment",
      // None of these are in the controller's ADMIN_ALLOWED whitelist, so
      // they must have zero effect on the persisted pricing.
      monthlyRent: 1,
      pricingSnapshot: { finalMonthlyRate: 1, regularMonthlyRate: 1 },
      totalPrice: 1,
    });
    const res = response();

    await updateReservation(req, res, jest.fn());

    expect(res.statusCode).toBe(200);
    const updated = await Reservation.findById(reservation._id).lean();
    expect(updated.pricingSnapshot.finalMonthlyRate).toBe(5400);
    expect(updated.pricingSnapshot.regularMonthlyRate).toBe(6000);
    expect(updated.monthlyRent).not.toBe(1);
  });
});
