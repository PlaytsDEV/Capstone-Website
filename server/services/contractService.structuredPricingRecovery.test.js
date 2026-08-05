/**
 * Regression test for the structured-workflow contract payment-verification fix.
 *
 * Proves that a contract previously stuck at "incomplete" solely because
 * buildInitialPaymentSummary read the legacy Reservation.paymentStatus field
 * (which structured reservations never write) can now reach
 * "ready_for_generation" through the ordinary validateContractForGeneration
 * path — no manual status repair, no fixture forcing the result.
 */
import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const records = {
  user: null,
  reservation: null,
  room: null,
  stay: null,
};

const query = (key) => ({
  lean: jest.fn().mockImplementation(async () => records[key]),
});

await jest.unstable_mockModule("../models/index.js", () => ({
  User: { findById: jest.fn(() => query("user")) },
  Reservation: { findById: jest.fn(() => query("reservation")) },
  Room: { findById: jest.fn(() => query("room")) },
  Stay: { findById: jest.fn(() => query("stay")) },
  Contract: { exists: jest.fn(async () => false) },
  ContractCounter: { findOneAndUpdate: jest.fn() },
}));

const { validateContractForGeneration } = await import("./contractService.js");

const incompleteStructuredContract = () => ({
  status: "incomplete",
  tenantId: "tenant-1",
  reservationId: "reservation-1",
  roomId: "room-1",
  stayId: null,
  branch: "gil-puyat",
  roomType: "private",
  roomNumber: "101",
  leaseType: "short_term",
  leaseStartDate: new Date("2026-01-01T00:00:00.000Z"),
  leaseEndDate: new Date("2026-02-01T00:00:00.000Z"),
  leaseDurationMonths: 1,
  executionDate: new Date("2026-01-01T00:00:00.000Z"),
  bedId: "fallback-bed",
  bedLabel: "fallback-label",
  tenantLegalName: "Canonical Tenant",
  tenantAddress: "Canonical Address",
  tenantNationality: "Filipino",
  tenantBirthDate: new Date("2000-01-01"),
  regularMonthlyRate: 6300,
  discountPercentage: 0,
  discountAmount: 0,
  approvedMonthlyRate: 6300,
  advanceRentAmount: 6300,
  securityDepositAmount: 6300,
  reservationFeeAmount: 2000,
  reservationFeeCreditAmount: 2000,
  pricingApprovalId: "reservation-1",
  pricingApprovedBy: "admin-1",
  pricingApprovedAt: new Date("2025-12-20"),
  advanceCoverageStart: new Date("2026-01-01T00:00:00.000Z"),
  advanceCoverageEnd: new Date("2026-02-01T00:00:00.000Z"),
});

beforeEach(() => {
  records.user = {
    _id: "tenant-1",
    firstName: "Canonical",
    lastName: "Tenant",
    email: "canonical@example.com",
    phone: "09170000000",
    nationality: "Filipino",
    address: "Canonical Address",
    dateOfBirth: new Date("2000-01-01"),
  };
  records.reservation = {
    _id: "reservation-1",
    userId: "tenant-1",
    roomId: "room-1",
    status: "reserved",
    applicationReviewedAt: new Date("2025-12-19"),
    applicationReviewedBy: "admin-1",
    reservationFeeAmount: 2000,
    // The confirmed root cause: a structured reservation never writes this
    // legacy field, so it stays at its unrelated default.
    paymentStatus: "pending",
    financialWorkflowVersion: "structured-initial-payment-v1",
    reservationFeePaymentStatus: "verified",
  };
  records.room = {
    _id: "room-1",
    branch: "gil-puyat",
    type: "private",
    roomNumber: "101",
  };
  records.stay = null;
});

describe("structured contract recovers through ordinary revalidation", () => {
  test("an incomplete structured contract with a verified reservation fee becomes ready_for_generation", async () => {
    const contract = incompleteStructuredContract();

    const result = await validateContractForGeneration(contract, {});

    expect(result.errors).not.toContainEqual(
      expect.objectContaining({ code: "RESERVATION_FEE_PAYMENT_NOT_VERIFIED" }),
    );
    expect(result.valid).toBe(true);
    expect(result.status).toBe("ready_for_generation");
  });

  test("the same contract stays incomplete while the reservation fee is still pending", async () => {
    records.reservation.reservationFeePaymentStatus = "pending";
    const contract = incompleteStructuredContract();

    const result = await validateContractForGeneration(contract, {});

    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "RESERVATION_FEE_PAYMENT_NOT_VERIFIED" }),
    );
    expect(result.valid).toBe(false);
    expect(result.status).toBe("incomplete");
  });
});
