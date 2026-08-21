import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const records = { contract: null, reservation: null, room: null, user: null, stay: null };

const query = (key) => {
  const q = {};
  q.populate = jest.fn().mockReturnValue(q);
  q.sort = jest.fn().mockReturnValue(q);
  q.lean = jest.fn().mockImplementation(async () => records[key]);
  return q;
};

await jest.unstable_mockModule("../models/index.js", () => ({
  Contract: {
    findById: jest.fn(() => query("contract")),
    findOne: jest.fn(() => query("contract")),
    find: jest.fn(() => ({ sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) })),
  },
  Reservation: {
    findById: jest.fn(() => query("reservation")),
    findOne: jest.fn(() => query("reservation")),
  },
  Room: { findById: jest.fn(() => query("room")) },
  Stay: { findById: jest.fn(() => query("stay")) },
  User: { findById: jest.fn(() => query("user")) },
}));

const { resolveDigitalStayProofData } = await import("./digitalStayProofService.js");

const CONTRACT_ID = "6c0000000000000000000001";
const RESERVATION_ID = "6c0000000000000000000002";
const TENANT_ID = "6c0000000000000000000003";
const ROOM_ID = "6c0000000000000000000004";

// Reproduces the production defect: a Contract already carrying the
// correct, internally-consistent Reservation-approved pricing snapshot
// (regularMonthlyRate=16000, discount=10%, approvedMonthlyRate=14400)
// still rendered "Php 13,500.00" in the Admin/Tenant Digital Contract
// preview, because resolveDigitalStayProofData's output never carried a
// field named approvedMonthlyRate/advanceRentAmount/securityDepositAmount
// (only monthlyRent/advanceRent/securityDeposit) — the exact field names
// DigitalContractPaper.jsx reads from stayData. Confirmed live for
// Contract LIL-GP-2026-00023.
describe("resolveDigitalStayProofData pricing field aliases", () => {
  beforeEach(() => {
    records.contract = null;
    records.reservation = null;
    records.room = null;
    records.user = null;
    records.stay = null;
  });

  test("exposes approvedMonthlyRate/advanceRentAmount/securityDepositAmount aliases matching the Contract snapshot verbatim", async () => {
    records.contract = {
      _id: CONTRACT_ID,
      tenantId: TENANT_ID,
      reservationId: RESERVATION_ID,
      roomId: ROOM_ID,
      contractNumber: "LIL-GP-2026-00023",
      tenantLegalName: "Test Tenant",
      tenantAddress: "Somewhere, Metro Manila",
      branch: "gil-puyat",
      roomType: "private",
      status: "incomplete",
      regularMonthlyRate: 16000,
      discountPercentage: 10,
      discountAmount: 1600,
      approvedMonthlyRate: 14400,
      advanceRentAmount: 14400,
      securityDepositAmount: 14400,
    };
    records.room = { _id: ROOM_ID, branch: "gil-puyat", type: "private", roomNumber: "GP-705", monthlyPrice: 13500, price: 14400 };

    const data = await resolveDigitalStayProofData({ contractId: CONTRACT_ID });

    expect(data.approvedMonthlyRate).toBe(14400);
    expect(data.advanceRentAmount).toBe(14400);
    expect(data.securityDepositAmount).toBe(14400);
    expect(data.regularMonthlyRate).toBe(16000);
    expect(data.discountPercentage).toBe(10);
    // Never the Room's own monthlyPrice/legacy hardcoded private-room default.
    expect(data.approvedMonthlyRate).not.toBe(13500);

    // Backward-compatible field names (Certificate-of-Stay HTML builder,
    // mapStayDataToContractPayload) must keep working unchanged.
    expect(data.monthlyRent).toBe(14400);
    expect(data.advanceRent).toBe(14400);
    expect(data.securityDeposit).toBe(14400);
  });
});
