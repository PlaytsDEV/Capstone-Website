/**
 * Integration test for the one-step room transfer + Contract cutover:
 * transferStayWorkflow (server/utils/tenantActionService.js) now
 *   1. prepares the replacement Contract as a tenant-visible generated
 *      Draft BEFORE the physical-transfer transaction (Stage A), then
 *   2. inside one Mongo transaction: performs the physical cutover
 *      (bed/occupancy, settlement Bill, BedHistory, Stay, Reservation) and
 *      calls activateRoomTransferSuccessorDraft as the last step —
 *      predecessor -> replaced, successor -> isCurrent + tenantVisible,
 *      status left at "generated" (wet-signing stays a later admin step).
 *
 * The Contract-PDF generation surface is mocked (real storage/template
 * rendering is out of scope here and not transaction-safe); everything
 * else — createReplacementContractForTransfer, the physical mutations, the
 * settlement math, and the Draft cutover — runs for real against a
 * single-node replica set.
 */
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, test, jest } from "@jest/globals";
import { MongoMemoryReplSet } from "mongodb-memory-server";

// ── Mock only the PDF-generation surface prepareRoomTransferDraft uses ─────
// validateContractForGeneration -> always valid; generatePreparedContractPdf
// -> advances the real successor Contract to "generated" with a prepared
// document entry, exactly like the real one but with no storage I/O.
const mockValidate = jest.fn(async () => ({
  valid: true,
  missingFields: [],
  errors: [],
  generationData: { pricing: {} },
  template: { templateId: "private_long_term", templateVersion: 1, legalContentVersion: 1 },
}));

await jest.unstable_mockModule("../services/contractPdfService.js", () => ({
  generatePreparedContractPdf: jest.fn(async ({ contractId, actorId }) => {
    const { Contract } = await import("../models/index.js");
    const { transitionContract } = await import("../services/contractService.js");
    const contract = await Contract.findById(contractId);
    const version = 1;
    contract.preparedDocuments = contract.preparedDocuments || [];
    contract.preparedDocuments.push({
      documentType: "prepared",
      version,
      storageProvider: "local",
      storageKey: `test/prepared_v${version}.pdf`,
      fileName: `prepared_v${version}.pdf`,
      fileHash: `preparedhash-${contract._id}-v${version}`,
      fileSize: 2048,
      pageCount: 4,
      templateId: "private_long_term",
      templateVersion: "1",
      coordinateVersion: "1",
      generatedAt: new Date(),
      generatedBy: actorId,
      superseded: false,
    });
    contract.generatedFileHash = `preparedhash-${contract._id}-v${version}`;
    contract.generatedVersion = version;
    contract.publicationStatus = "ready_for_resident";
    contract.tenantVisible = true;
    if (contract.status === "ready_for_generation") {
      await transitionContract(contract, "generated", actorId, "Prepared Contract PDF generated (test)");
    } else {
      await contract.save();
    }
    return { contract, document: contract.preparedDocuments.at(-1), previousStatus: "ready_for_generation", isRegeneration: false };
  }),
}));

// validateContractForGeneration is re-exported from contractService alongside
// many real functions the workflow needs — partial-mock it.
const realContractService = await import("../services/contractService.js");
await jest.unstable_mockModule("../services/contractService.js", () => ({
  ...realContractService,
  validateContractForGeneration: mockValidate,
}));

const { transferStayWorkflow } = await import("./tenantActionService.js");
const { generateContractNumber } = await import("../services/contractService.js");
const { Contract, Reservation, Room, User, Stay, BedHistory, Bill, BusinessSettings } = await import("../models/index.js");

jest.setTimeout(120_000);

describe("transferStayWorkflow — one-step Draft cutover", () => {
  let mongo;

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri(), { dbName: "transfer_cutover_v2" });
  }, 120_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  }, 120_000);

  beforeEach(async () => {
    await Promise.all([
      Reservation.deleteMany({}), Room.deleteMany({}), User.deleteMany({}),
      Contract.deleteMany({}), Stay.deleteMany({}), BedHistory.deleteMany({}),
      Bill.deleteMany({}), BusinessSettings.deleteMany({}),
    ]);
    await BusinessSettings.create({
      key: "global", quadrupleDiscountPercent: 10, doubleDiscountPercent: 5,
      isDiscountEnabled: true, longTermLeaseMinMonths: 6,
    });
    mockValidate.mockClear();
  });

  // Both rooms are the SAME type (double-sharing) — a room-type change is
  // not a transfer. Source rate 5400, destination rate 6300.
  async function seedScenario({ destBeds } = {}) {
    const tenant = await User.create({
      firebaseUid: `firebase-${new mongoose.Types.ObjectId()}`,
      email: `tenant-${new mongoose.Types.ObjectId()}@example.test`,
      username: `tenant_${new mongoose.Types.ObjectId().toString().slice(-10)}`,
      firstName: "Test", lastName: "Tenant", role: "tenant", tenantStatus: "active",
    });
    const roomA = await Room.create({
      name: "Room 301", roomNumber: "301", branch: "gil-puyat",
      type: "double-sharing", capacity: 2, currentOccupancy: 1, price: 5400,
      beds: [
        { id: "bed-a1", position: "lower", status: "occupied", occupiedBy: { userId: tenant._id, reservationId: null } },
        { id: "bed-a2", position: "upper", status: "available" },
      ],
    });
    const roomB = await Room.create({
      name: "Room 305", roomNumber: "305", branch: "gil-puyat",
      type: "double-sharing", capacity: 2, currentOccupancy: 0, price: 6300,
      beds: destBeds || [
        { id: "bed-b1", position: "lower", status: "available" },
        { id: "bed-b2", position: "upper", status: "available" },
      ],
    });
    const reservation = await Reservation.create({
      userId: tenant._id, roomId: roomA._id, status: "moveIn", leaseDuration: 6,
      reservationFeeAmount: 2000, preferredRoomType: "double-sharing",
      agreedToPrivacy: true, agreedToCertification: true, totalPrice: 5400,
      selectedBed: { id: "bed-a1" }, moveInDate: new Date("2026-08-01T00:00:00.000Z"),
    });
    roomA.beds[0].occupiedBy.reservationId = reservation._id;
    await roomA.save();

    const stay = await Stay.create({
      tenantId: tenant._id, reservationId: reservation._id, branch: roomA.branch,
      roomId: roomA._id, bedId: "bed-a1",
      leaseStartDate: new Date("2026-08-01T00:00:00.000Z"),
      leaseEndDate: new Date("2027-01-31T00:00:00.000Z"),
      monthlyRent: 5400, status: "active",
    });
    const bedHistory = await BedHistory.create({
      bedId: "bed-a1", roomId: roomA._id, tenantId: tenant._id, reservationId: reservation._id,
      stayId: stay._id, branch: roomA.branch, moveInDate: new Date("2026-08-01T00:00:00.000Z"),
      status: "active",
    });

    const actorId = new mongoose.Types.ObjectId();
    const numberA = await generateContractNumber(roomA.branch, new Date());
    const predecessor = await Contract.create({
      ...numberA, contractPurpose: "initial", tenantId: tenant._id, applicationId: reservation._id,
      reservationId: reservation._id, stayId: stay._id, roomId: roomA._id, branch: roomA.branch,
      propertyName: "Lilycrest Dormitory", propertyAddress: "123 Test St.", roomNumber: roomA.roomNumber,
      roomType: "double-sharing", leaseType: "long_term", approvedMonthlyRate: 5400,
      leaseStartDate: new Date("2026-08-01T00:00:00.000Z"),
      leaseEndDate: new Date("2027-01-31T00:00:00.000Z"), leaseDurationMonths: 6,
      status: "active", isCurrent: true,
      statusHistory: [{ status: "active", changedBy: actorId, reason: "seed" }],
      createdBy: actorId, updatedBy: actorId,
    });

    return { tenant, roomA, roomB, reservation, stay, bedHistory, predecessor, actorId };
  }

  test("generates the replacement Draft, moves physical state, flips isCurrent, leaves successor at 'generated'", async () => {
    const { tenant, roomA, roomB, reservation, stay, bedHistory, predecessor, actorId } = await seedScenario();

    const result = await transferStayWorkflow({
      reservationId: reservation._id,
      payload: {
        confirm: true, targetRoomId: roomB._id, targetBedId: "bed-b1",
        effectiveTransferDate: "2026-08-15T00:00:00.000Z",
      },
      actorId,
    });

    // Contract cutover: predecessor replaced, successor is the current Draft.
    expect(result.contractCutover.predecessorStatus).toBe("replaced");
    expect(result.contractCutover.successorStatus).toBe("generated");

    const [reloadedStay, reloadedRoomA, reloadedRoomB, reloadedPredecessor, reloadedReservation, reloadedBedHistory, successor, transferBill] = await Promise.all([
      Stay.findById(stay._id),
      Room.findById(roomA._id),
      Room.findById(roomB._id),
      Contract.findById(predecessor._id),
      Reservation.findById(reservation._id),
      BedHistory.findById(bedHistory._id),
      Contract.findOne({ replacesContractId: predecessor._id, contractPurpose: "replacement" }),
      Bill.findOne({ reservationId: reservation._id, billType: "transfer_settlement" }),
    ]);

    expect(String(reloadedStay.roomId)).toBe(String(roomB._id));
    expect(reloadedStay.bedId).toBe("bed-b1");
    expect(reloadedRoomA.beds.find((b) => b.id === "bed-a1").status).toBe("available");
    expect(reloadedRoomB.beds.find((b) => b.id === "bed-b1").status).toBe("occupied");
    expect(String(reloadedReservation.roomId)).toBe(String(roomB._id));
    expect(reloadedBedHistory.status).toBe("transferred");

    expect(reloadedPredecessor.status).toBe("replaced");
    expect(reloadedPredecessor.isCurrent).toBe(false);
    expect(String(reloadedPredecessor.supersededByContractId)).toBe(String(successor._id));

    // Successor: a tenant-visible generated Draft that is now current — NOT active.
    expect(successor.status).toBe("generated");
    expect(successor.isCurrent).toBe(true);
    expect(successor.tenantVisible).toBe(true);
    expect(successor.finalDocument == null).toBe(true);
    expect(String(successor.roomId)).toBe(String(roomB._id));

    // Future rent bills the destination approved rate.
    expect(reloadedReservation.monthlyRent).toBe(successor.approvedMonthlyRate);

    // Settlement: moveIn Aug 1, transfer Aug 15, cycle Aug1-Sep1 (31d) -> 14 source days.
    expect(transferBill).toBeTruthy();
    expect(transferBill.proRataDays).toBe(14);
    expect(transferBill.transferSnapshot.totalCoverageDays).toBe(31);
    expect(transferBill.transferSnapshot.destinationDays).toBe(17);
    expect(transferBill.transferSnapshot.sourceApprovedRate).toBe(5400);
    expect(transferBill.transferSnapshot.destinationApprovedRate).toBe(successor.approvedMonthlyRate);
    expect(transferBill.transferSnapshot.proRataRent + transferBill.transferSnapshot.unusedPrepaidCredit)
      .toBeCloseTo(5400, 2);
  });

  test("rejects a cross-room-type transfer before preparing anything", async () => {
    const { roomA, reservation, predecessor, actorId } = await seedScenario();
    const privateRoom = await Room.create({
      name: "Room 101", roomNumber: "101", branch: "gil-puyat",
      type: "private", capacity: 1, currentOccupancy: 0, price: 14400,
      beds: [{ id: "bed-p1", position: "single", status: "available" }],
    });

    await expect(transferStayWorkflow({
      reservationId: reservation._id,
      payload: { confirm: true, targetRoomId: privateRoom._id, effectiveTransferDate: "2026-08-15T00:00:00.000Z" },
      actorId,
    })).rejects.toMatchObject({ code: "CROSS_TYPE_TRANSFER_NOT_ALLOWED" });

    // Nothing was prepared, predecessor untouched.
    const successorCount = await Contract.countDocuments({ replacesContractId: predecessor._id });
    expect(successorCount).toBe(0);
    const reloadedRoomA = await Room.findById(roomA._id);
    expect(reloadedRoomA.beds.find((b) => b.id === "bed-a1").status).toBe("occupied");
  });

  test("requires a target bed for a shared destination room", async () => {
    const { roomB, reservation, actorId } = await seedScenario();

    await expect(transferStayWorkflow({
      reservationId: reservation._id,
      payload: { confirm: true, targetRoomId: roomB._id, effectiveTransferDate: "2026-08-15T00:00:00.000Z" },
      actorId,
    })).rejects.toMatchObject({ code: "MISSING_TRANSFER_FIELDS" });
  });

  test("rejects when the destination bed is not available", async () => {
    const { roomB, reservation, actorId } = await seedScenario({
      destBeds: [
        { id: "bed-b1", position: "lower", status: "occupied", occupiedBy: { userId: new mongoose.Types.ObjectId() } },
        { id: "bed-b2", position: "upper", status: "available" },
      ],
    });

    await expect(transferStayWorkflow({
      reservationId: reservation._id,
      payload: { confirm: true, targetRoomId: roomB._id, targetBedId: "bed-b1", effectiveTransferDate: "2026-08-15T00:00:00.000Z" },
      actorId,
    })).rejects.toMatchObject({ code: "BED_NOT_AVAILABLE" });
  });

  test("blocks with an outstanding balance unless forceOverride", async () => {
    const { tenant, roomA, roomB, reservation, actorId } = await seedScenario();
    await Bill.create({
      billType: "monthly", reservationId: reservation._id, userId: tenant._id,
      branch: roomA.branch, roomId: roomA._id, billingMonth: new Date("2026-08-01T00:00:00.000Z"),
      billingCycleStart: new Date("2026-08-01T00:00:00.000Z"), billingCycleEnd: new Date("2026-09-01T00:00:00.000Z"),
      charges: { rent: 5400, electricity: 0, water: 0, applianceFees: 0, corkageFees: 0, penalty: 0, discount: 0 },
      totalAmount: 5400, grossAmount: 5400, remainingAmount: 5400, paidAmount: 0, status: "pending",
    });

    await expect(transferStayWorkflow({
      reservationId: reservation._id,
      payload: { confirm: true, targetRoomId: roomB._id, targetBedId: "bed-b1", effectiveTransferDate: "2026-08-15T00:00:00.000Z" },
      actorId,
    })).rejects.toMatchObject({ code: "OUTSTANDING_BILLS_BLOCKING_TRANSFER" });

    // forceOverride proceeds.
    const result = await transferStayWorkflow({
      reservationId: reservation._id,
      payload: { confirm: true, targetRoomId: roomB._id, targetBedId: "bed-b1", forceOverride: true, effectiveTransferDate: "2026-08-15T00:00:00.000Z" },
      actorId,
    });
    expect(result.contractCutover.successorStatus).toBe("generated");
  });

  test("retrying the same transfer after success is rejected and does not double-bill or duplicate the successor", async () => {
    const { roomB, reservation, predecessor, actorId } = await seedScenario();

    await transferStayWorkflow({
      reservationId: reservation._id,
      payload: { confirm: true, targetRoomId: roomB._id, targetBedId: "bed-b1", effectiveTransferDate: "2026-08-15T00:00:00.000Z" },
      actorId,
    });

    // After success the predecessor is "replaced" and the tenant's current
    // Contract is the just-activated successor Draft — a retry can't find a
    // valid predecessor to transfer from. Either guard (predecessor no
    // longer active, or same-target) is an acceptable "retry blocked".
    await expect(transferStayWorkflow({
      reservationId: reservation._id,
      payload: { confirm: true, targetRoomId: roomB._id, targetBedId: "bed-b1", forceOverride: true, effectiveTransferDate: "2026-08-15T00:00:00.000Z" },
      actorId,
    })).rejects.toMatchObject({
      code: expect.stringMatching(/ROOM_TRANSFER_PREDECESSOR_NOT_ACTIVE|SAME_TRANSFER_TARGET/),
    });

    const [successors, settlementBills] = await Promise.all([
      Contract.find({ replacesContractId: predecessor._id, contractPurpose: "replacement" }),
      Bill.find({ reservationId: reservation._id, billType: "transfer_settlement" }),
    ]);
    expect(successors).toHaveLength(1);
    expect(settlementBills).toHaveLength(1);
  });

  test("exactly one current Contract and one active Stay after a successful transfer", async () => {
    const { tenant, roomB, reservation, actorId } = await seedScenario();

    await transferStayWorkflow({
      reservationId: reservation._id,
      payload: { confirm: true, targetRoomId: roomB._id, targetBedId: "bed-b1", effectiveTransferDate: "2026-08-15T00:00:00.000Z" },
      actorId,
    });

    const [currentContracts, activeStays] = await Promise.all([
      Contract.countDocuments({ tenantId: tenant._id, isCurrent: true }),
      Stay.countDocuments({ tenantId: tenant._id, status: "active" }),
    ]);
    expect(currentContracts).toBe(1);
    expect(activeStays).toBe(1);
  });

  test("the historical predecessor Contract and the closed BedHistory are preserved", async () => {
    const { reservation, stay, bedHistory, predecessor, roomB, actorId } = await seedScenario();

    await transferStayWorkflow({
      reservationId: reservation._id,
      payload: { confirm: true, targetRoomId: roomB._id, targetBedId: "bed-b1", effectiveTransferDate: "2026-08-15T00:00:00.000Z" },
      actorId,
    });

    const [reloadedPredecessor, oldBedHistory, activeBedHistories] = await Promise.all([
      Contract.findById(predecessor._id),
      BedHistory.findById(bedHistory._id),
      BedHistory.find({ stayId: stay._id, status: "active" }),
    ]);
    expect(reloadedPredecessor).toBeTruthy();
    expect(reloadedPredecessor.status).toBe("replaced");
    expect(oldBedHistory.status).toBe("transferred");
    expect(oldBedHistory.moveOutDate).toBeTruthy();
    expect(activeBedHistories).toHaveLength(1);
    expect(String(activeBedHistories[0].roomId)).toBe(String(roomB._id));
  });
});
