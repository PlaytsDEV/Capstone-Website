/**
 * Integration test for the new reservation-settlement → draft Contract
 * automation: once a reservation's initial deposit/reservation-fee payment
 * is verified (settleReservationDeposit transitions it to "reserved"), the
 * authoritative draft Contract must exist without requiring a separate
 * manual POST /api/contracts action.
 *
 * Uses a real (single-node) replica set via MongoMemoryReplSet because
 * settleReservationDeposit runs inside a genuine Mongo transaction
 * (mongoSession.withTransaction), which a standalone MongoMemoryServer
 * cannot support.
 */
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "@jest/globals";
import { MongoMemoryReplSet } from "mongodb-memory-server";

import { settleReservationDeposit } from "./reservationDepositSettlementService.js";
import { createDraftContract } from "./contractService.js";
import { Contract, Payment, Reservation, Room, User, BusinessSettings } from "../models/index.js";

describe("reservation deposit settlement → draft Contract automation", () => {
  let mongo;

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri(), { dbName: "settlement_contract_automation" });
    // Only sync indexes actually load-bearing for these assertions —
    // Reservation's full index set includes a partial-filter spec this
    // memory-server's mongod build rejects and is unrelated to what's
    // being tested here (Contract's own uniqueness guarantees are what
    // matter for the duplicate/race assertions below).
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
      Payment.deleteMany({}),
      BusinessSettings.deleteMany({}),
    ]);
    await BusinessSettings.create({
      key: "global",
      quadrupleDiscountPercent: 10,
      isDiscountEnabled: true,
      longTermLeaseMinMonths: 6,
    });
  });

  async function seedTenantRoomReservation({
    leaseDuration = 12,
    status = "approved_for_payment",
    targetMoveInOnly = false,
  } = {}) {
    const tenant = await User.create({
      firebaseUid: `firebase-${new mongoose.Types.ObjectId()}`,
      email: `tenant-${new mongoose.Types.ObjectId()}@example.test`,
      username: `tenant_${new mongoose.Types.ObjectId().toString().slice(-10)}`,
      firstName: "Test",
      lastName: "Tenant",
      role: "applicant",
    });
    const room = await Room.create({
      name: "Room 301",
      roomNumber: "301",
      branch: "gil-puyat",
      type: "quadruple-sharing",
      capacity: 4,
      price: 6300,
    });
    const reservation = await Reservation.create({
      userId: tenant._id,
      roomId: room._id,
      status,
      leaseDuration,
      reservationFeeAmount: 2000,
      preferredRoomType: "quadruple-sharing",
      agreedToPrivacy: true,
      agreedToCertification: true,
      totalPrice: 6300,
      moveInDate: targetMoveInOnly ? null : new Date("2026-09-01T00:00:00.000Z"),
      targetMoveInDate: targetMoveInOnly ? new Date("2026-09-01T00:00:00.000Z") : null,
    });
    return { tenant, room, reservation };
  }

  // Mirrors what the real approved_for_payment transition does
  // (reservationLifecycleController.js) without pulling in that
  // controller's full email/socket/notification dependency graph — the
  // Contract-automation tests only need the resulting authoritative
  // pricingSnapshot the same way settlement/createDraftContract consume it.
  async function approveForStructuredPayment(reservation, room) {
    const { buildStructuredPricingSnapshot } = await import("./structuredInitialPaymentPolicy.js");
    const snapshot = buildStructuredPricingSnapshot({
      reservation,
      room,
      businessSettings: { quadrupleDiscountPercent: 10, isDiscountEnabled: true, longTermLeaseMinMonths: 6 },
    });
    reservation.financialWorkflowVersion = "structured-initial-payment-v1";
    reservation.pricingSnapshot = snapshot;
    reservation.pricingSnapshotVersion = 1;
    reservation.status = "approved_for_payment";
    await reservation.save();
    return reservation;
  }

  function settleFor(reservation, overrides = {}) {
    return settleReservationDeposit({
      reservationId: reservation._id,
      source: "manual_proof",
      paidAmount: 2000,
      idempotencyKey: `settle-${reservation._id}`,
      actor: { role: "branch_admin" },
      ...overrides,
    });
  }

  test("settling the deposit creates exactly one authoritative draft Contract", async () => {
    const { reservation, tenant, room } = await seedTenantRoomReservation();

    const result = await settleFor(reservation);

    expect(result.settled).toBe(true);
    expect(result.reservation.status).toBe("reserved");
    expect(result.draftContract).toBeTruthy();
    expect(result.draftContract.status).toBe("draft");
    expect(String(result.draftContract.tenantId)).toBe(String(tenant._id));
    expect(String(result.draftContract.reservationId)).toBe(String(reservation._id));
    expect(result.draftContract.branch).toBe(room.branch);

    const contracts = await Contract.find({ reservationId: reservation._id });
    expect(contracts).toHaveLength(1);
  });

  test("draft Contract fields mirror the authoritative structured pricing snapshot, not a recomputed value", async () => {
    const { reservation, room } = await seedTenantRoomReservation({ leaseDuration: 12 });
    await approveForStructuredPayment(reservation, room);
    const result = await settleFor(reservation);

    expect(result.draftContract.roomType).toBe("quadruple-sharing");
    expect(result.draftContract.leaseType).toBe("long_term");
    // Matches the approval-pricing integration test's 5400 figure for the
    // same 10%-discount quadruple/12-month combination — proves Contract
    // creation reads the already-approved snapshot instead of recomputing it.
    expect(result.draftContract.approvedMonthlyRate).toBe(5400);
    expect(result.draftContract.advanceRentAmount).toBe(5400);
    expect(result.draftContract.securityDepositAmount).toBe(5400);
    expect(result.draftContract.leaseDurationMonths).toBe(12);
    expect(result.draftContract.roomNumber).toBe(room.roomNumber);
  });

  test("calling settlement twice with the same idempotency key does not create a second Contract", async () => {
    const { reservation } = await seedTenantRoomReservation();
    const idempotencyKey = `dup-key-${reservation._id}`;

    const first = await settleFor(reservation, { idempotencyKey });
    const second = await settleFor(reservation, { idempotencyKey });

    expect(first.draftContract).toBeTruthy();
    expect(second.idempotent).toBe(true);
    // The replay path also runs ensureDraftContractForSettledReservation —
    // it must recognize the Contract already exists rather than erroring.
    const contracts = await Contract.find({ reservationId: reservation._id });
    expect(contracts).toHaveLength(1);
  });

  test("simultaneous settlement attempts (race) still produce exactly one Contract", async () => {
    const { reservation } = await seedTenantRoomReservation();

    const [a, b] = await Promise.allSettled([
      settleFor(reservation, { idempotencyKey: "race-a" }),
      settleFor(reservation, { idempotencyKey: "race-b" }),
    ]);

    // At least one settlement must succeed; Mongo's write-conflict retry
    // inside withTransaction plus the reservation-status transaction lock
    // means the pair may serialize rather than both "succeeding" independently.
    expect([a.status, b.status]).toContain("fulfilled");
    const contracts = await Contract.find({ reservationId: reservation._id });
    expect(contracts).toHaveLength(1);
  });

  test("a reservation that already has a Contract (manual pre-creation) is not duplicated by settlement", async () => {
    const { reservation, tenant, room } = await seedTenantRoomReservation();
    const manual = await createDraftContract({ reservationId: reservation._id, actorId: tenant._id });

    const result = await settleFor(reservation);

    // The existing canonical draft is returned/reused. DUPLICATE_CONTRACT
    // still prevents a second record, but no longer turns recovery of the
    // already-authoritative draft into a permanent no-op.
    expect(String(result.draftContract._id)).toBe(String(manual._id));
    const contracts = await Contract.find({ reservationId: reservation._id });
    expect(contracts).toHaveLength(1);
    expect(String(contracts[0]._id)).toBe(String(manual._id));
    void room;
  });

  test("DUPLICATE_CONTRACT reuses and repairs a legacy targetMoveInDate-only draft", async () => {
    const { reservation, tenant, room } = await seedTenantRoomReservation({ targetMoveInOnly: true });
    room.type = "private";
    room.capacity = 1;
    await room.save();
    reservation.applicationReviewedAt = new Date("2026-08-20T00:00:00.000Z");
    reservation.applicationReviewedBy = tenant._id;
    reservation.approvedForPaymentAt = new Date("2026-08-20T00:00:00.000Z");
    reservation.preferredRoomType = "private";
    reservation.selectedBed = undefined;
    await reservation.save();
    const legacyDraft = await createDraftContract({
      reservationId: reservation._id,
      actorId: tenant._id,
    });
    await Contract.collection.updateOne(
      { _id: legacyDraft._id },
      {
        $set: {
          leaseStartDate: null,
          leaseEndDate: null,
          advanceCoverageStart: null,
          advanceCoverageEnd: null,
        },
      },
    );

    const result = await settleFor(reservation);

    expect(String(result.draftContract._id)).toBe(String(legacyDraft._id));
    const contracts = await Contract.find({ reservationId: reservation._id });
    expect(contracts).toHaveLength(1);
    expect(contracts[0].leaseStartDate.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(contracts[0].leaseEndDate.toISOString()).toBe("2027-09-01T00:00:00.000Z");
  });

  test("settlement still succeeds and the reservation is not left partially inconsistent even if Contract creation is impossible", async () => {
    // A Stay already linked to this reservation but recorded under a
    // different (still schema-valid) branch than the room itself —
    // createDraftContract's stay-vs-room branch-conflict guard throws
    // CONTRACT_BRANCH_CONFLICT deterministically. This is the schema-valid
    // way to force Contract creation to fail without touching any of
    // settlement's own preconditions (tenant/room/payment all still valid).
    const { Stay } = await import("../models/index.js");
    const { tenant, room, reservation } = await seedTenantRoomReservation();
    await Stay.create({
      tenantId: tenant._id,
      reservationId: reservation._id,
      branch: "guadalupe", // conflicts with room.branch === "gil-puyat"
      roomId: room._id,
      bedId: "bed-1",
      leaseStartDate: new Date("2026-09-01T00:00:00.000Z"),
      leaseEndDate: new Date("2027-09-01T00:00:00.000Z"),
      status: "active",
    });

    const result = await settleFor(reservation);

    // Payment settlement is authoritative and must not roll back just
    // because Contract drafting failed downstream.
    expect(result.settled).toBe(true);
    const updatedReservation = await Reservation.findById(reservation._id).lean();
    expect(updatedReservation.status).toBe("reserved");
    expect(updatedReservation.paymentStatus).toBe("paid");
    // No Contract exists — this is the documented "repair on next safe
    // lifecycle event" case, not a silent success.
    const contracts = await Contract.find({ reservationId: reservation._id });
    expect(contracts).toHaveLength(0);
  });

  test("mobile-relevant: the created draft Contract is immediately eligible for mobile visibility (includeEarlyStages)", async () => {
    const { reservation, tenant } = await seedTenantRoomReservation();
    const result = await settleFor(reservation);

    const { resolveTenantCanonicalContract } = await import("./tenantContractSelectionService.js");
    const mobileVisible = await resolveTenantCanonicalContract(tenant._id, { includeEarlyStages: true });
    expect(String(mobileVisible?._id)).toBe(String(result.draftContract._id));
    expect(mobileVisible.status).toBe("draft");

    const webVisible = await resolveTenantCanonicalContract(tenant._id);
    expect(webVisible).toBeNull(); // unchanged Web "My Contract" behavior — draft still hidden there
  });
});
