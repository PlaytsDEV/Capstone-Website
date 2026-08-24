/**
 * Future-tenant acceptance test for the permanent contract-lifecycle fix.
 *
 * This exercises the full normal runtime path for a brand-new tenant with no
 * manual DB repair, no backfill script, and no tenant-specific logic:
 *
 *   Reservation created -> Admin approves via the real updateReservation
 *   controller (real auth shape: req.user.uid + req.authUser._id) ->
 *   applicationReviewedAt/By are populated automatically ->
 *   resolveReservationContractEligibility (the same function the real
 *   generator, Job 19, and the legacy-confirm action all share) is
 *   evaluated -> a Contract is created through the normal
 *   createDraftContract path -> Contract-level field validation
 *   (getContractValidation) is checked.
 *
 * Room-type coverage (Phase 9 of the lifecycle fix):
 *   - Private:    no bed required, blank bed fields are valid
 *   - Double:     no bed required, blank bed fields are valid
 *   - Quadruple:  a real bed assignment is required and must propagate
 *   - Quadruple, no bed assigned: eligibility is blocked with a clear,
 *     retryable blocker and no bed is fabricated
 */
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { MongoMemoryReplSet } from "mongodb-memory-server";

await jest.unstable_mockModule("../config/email.js", () => ({
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
await jest.unstable_mockModule("../utils/socket.js", () => ({
  emitToUser: jest.fn(),
  emitToAdmins: jest.fn(),
  emitRoomUpdate: jest.fn(),
}));
await jest.unstable_mockModule("../middleware/logger.js", () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
await jest.unstable_mockModule("../utils/auditLogger.js", () => ({
  default: { log: jest.fn(), logError: jest.fn(), logModification: jest.fn() },
}));
await jest.unstable_mockModule("../services/occupancy/occupancyManager.js", () => ({
  deriveRoomOccupancyState: jest.fn(),
  updateOccupancyOnReservationChange: jest.fn(),
  recalculateRoomOccupancy: jest.fn(),
  getRoomOccupancyStatus: jest.fn(),
  getBranchOccupancyStats: jest.fn(),
  releaseOrphanedBeds: jest.fn(),
  getDisplayStatusForReservation: jest.fn(() => "locked"),
  default: {},
}));

const { updateReservation } = await import(
  "../controllers/reservations/reservationLifecycleController.js"
);
const { createDraftContract, getContractValidation } = await import("./contractService.js");
const { resolveReservationContractEligibility } = await import(
  "./reservationContractEligibilityService.js"
);
const { default: Reservation } = await import("../models/Reservation.js");
const { default: Room } = await import("../models/Room.js");
const { default: User } = await import("../models/User.js");
const { default: Contract } = await import("../models/Contract.js");
const { default: BusinessSettings } = await import("../models/BusinessSettings.js");

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

describe("Future-tenant acceptance: approval -> eligibility -> Contract creation (no manual repair)", () => {
  let mongo;
  let admin;

  beforeAll(async () => {
    process.env.STRUCTURED_INITIAL_PAYMENT_ENABLED = "true";
    delete process.env.STRUCTURED_INITIAL_PAYMENT_EFFECTIVE_AT;
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri(), { dbName: "future_tenant_acceptance" });
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
    admin = await User.create({
      firebaseUid: "future-tenant-reviewer-uid",
      username: "future-tenant-reviewer",
      email: "reviewer@lilycrest.test",
      firstName: "Reviewer",
      lastName: "Admin",
      role: "branch_admin",
      branch: "gil-puyat",
    });
  });

  const requestFor = (reservationId, body) => ({
    id: "future-tenant-acceptance-test",
    params: { reservationId },
    body,
    // Real production auth shape — no fabricated req.adminId.
    user: { uid: admin.firebaseUid },
    authUser: { _id: admin._id },
    branchFilter: undefined,
  });

  async function seedTenantAndReservation({ roomType, capacity, selectedBed = null }) {
    const tenant = await User.create({
      firebaseUid: `firebase-${new mongoose.Types.ObjectId()}`,
      email: `tenant-${new mongoose.Types.ObjectId()}@example.test`,
      username: `tenant_${new mongoose.Types.ObjectId().toString().slice(-10)}`,
      firstName: "Future", lastName: "Tenant", role: "applicant",
    });
    const room = await Room.create({
      name: `Room ${roomType}`,
      roomNumber: `R-${new mongoose.Types.ObjectId().toString().slice(-4)}`,
      branch: "gil-puyat",
      type: roomType,
      capacity,
      price: 6300,
      ...(selectedBed
        ? { beds: [{ id: selectedBed.id, position: "single", bunkBlock: "A", code: selectedBed.code, status: "reserved" }] }
        : {}),
    });
    const reservation = await Reservation.create({
      userId: tenant._id,
      roomId: room._id,
      status: "pending_application_review",
      leaseDuration: 12,
      reservationFeeAmount: 2000,
      preferredRoomType: roomType,
      agreedToPrivacy: true,
      agreedToCertification: true,
      totalPrice: 6300,
      moveInDate: new Date("2026-09-01T00:00:00.000Z"),
      ...(selectedBed ? { selectedBed } : {}),
    });
    return { tenant, room, reservation };
  }

  async function approve(reservation) {
    const req = requestFor(String(reservation._id), { status: "approved_for_payment" });
    const res = response();
    await updateReservation(req, res, jest.fn());
    return res;
  }

  test("Private: approval succeeds, no bed required, eligibility and Contract creation succeed with blank bed fields", async () => {
    const { room, reservation } = await seedTenantAndReservation({ roomType: "private", capacity: 1 });
    const res = await approve(reservation);
    expect(res.statusCode).toBe(200);

    const approved = await Reservation.findById(reservation._id).lean();
    expect(approved.applicationReviewedAt).toBeTruthy();
    expect(approved.applicationReviewedBy).toBeTruthy();
    expect(String(approved.applicationReviewedBy)).toBe(String(admin._id));

    const eligibility = resolveReservationContractEligibility(approved, {
      tenantExists: true, roomExists: true, roomType: room.type, bedExists: false,
    });
    expect(eligibility).toMatchObject({ eligible: true, approvalState: "approved" });

    const contract = await createDraftContract({ reservationId: approved._id, actorId: admin._id });
    expect(contract.bedId).toBe("");
    expect(contract.bedLabel).toBe("");
    const validation = getContractValidation(contract);
    expect(validation.missingFields.map((f) => f.field)).not.toContain("bedId");
  });

  test("Double: approval succeeds, no bed required, eligibility and Contract creation succeed with blank bed fields", async () => {
    const { room, reservation } = await seedTenantAndReservation({ roomType: "double-sharing", capacity: 2 });
    const res = await approve(reservation);
    expect(res.statusCode).toBe(200);

    const approved = await Reservation.findById(reservation._id).lean();
    const eligibility = resolveReservationContractEligibility(approved, {
      tenantExists: true, roomExists: true, roomType: room.type, bedExists: false,
    });
    expect(eligibility).toMatchObject({ eligible: true, approvalState: "approved" });

    const contract = await createDraftContract({ reservationId: approved._id, actorId: admin._id });
    const validation = getContractValidation(contract);
    expect(validation.missingFields.map((f) => f.field)).not.toContain("bedId");
  });

  test("Quadruple with a real bed assignment: eligibility succeeds and the authoritative bed propagates onto the Contract", async () => {
    const selectedBed = { id: "bed-401-A", position: "upper", bunkBlock: "A", code: "401-A-U" };
    const { room, reservation } = await seedTenantAndReservation({
      roomType: "quadruple-sharing", capacity: 4, selectedBed,
    });
    const res = await approve(reservation);
    expect(res.statusCode).toBe(200);

    const approved = await Reservation.findById(reservation._id).lean();
    const eligibility = resolveReservationContractEligibility(approved, {
      tenantExists: true, roomExists: true, roomType: room.type, bedExists: true,
    });
    expect(eligibility).toMatchObject({ eligible: true, approvalState: "approved" });

    const contract = await createDraftContract({ reservationId: approved._id, actorId: admin._id });
    expect(contract.bedId).toBe(selectedBed.id);
    expect(contract.bedLabel).toBe(selectedBed.code);
    const validation = getContractValidation(contract);
    expect(validation.missingFields.map((f) => f.field)).not.toContain("bedId");
  });

  test("Quadruple with no bed assignment: eligibility is blocked with a clear, retryable blocker — no bed is fabricated", async () => {
    const { room, reservation } = await seedTenantAndReservation({
      roomType: "quadruple-sharing", capacity: 4,
    });
    const res = await approve(reservation);
    expect(res.statusCode).toBe(200);

    const approved = await Reservation.findById(reservation._id).lean();
    expect(approved.applicationReviewedBy).toBeTruthy();

    const eligibility = resolveReservationContractEligibility(approved, {
      tenantExists: true, roomExists: true, roomType: room.type, bedExists: false,
    });
    expect(eligibility).toMatchObject({
      eligible: false,
      approvalState: "bed_assignment_required",
      blockers: [{ code: "RESERVATION_BED_ASSIGNMENT_REQUIRED", retryable: true }],
    });

    const contract = await createDraftContract({ reservationId: approved._id, actorId: admin._id });
    expect(contract.bedId).toBe("");
    const validation = getContractValidation(contract);
    expect(validation.missingFields.map((f) => f.field)).toContain("bedId");
  });
});
