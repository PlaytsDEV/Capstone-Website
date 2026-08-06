import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { Bill, Reservation, Room, Stay } from "../models/index.js";
import {
  getStructuredMoveInBlockers,
  getStructuredMoveInReadinessSummary,
} from "./structuredInitialPaymentService.js";

const queryResult = (value) => ({
  select: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(value),
});
const readyReservation = (overrides = {}) => ({
  _id: "507f1f77bcf86cd799439010",
  financialWorkflowVersion: "structured-initial-payment-v1",
  reservationFeePaymentStatus: "verified",
  initialPaymentBillId: "507f1f77bcf86cd799439012",
  pricingSnapshot: {
    approvedAt: new Date("2026-08-02T00:00:00.000Z"),
    branchId: "gil-puyat",
  },
  emergencyContact: { name: "Emergency Contact", contactNumber: "09170000000" },
  selfiePhotoUrl: "private://selfie",
  validIDFrontUrl: "private://front",
  validIDBackUrl: "private://back",
  agreedToPrivacy: true,
  agreedToCertification: true,
  houseRulesPreparedAt: new Date("2026-08-02T00:00:00.000Z"),
  roomId: "507f1f77bcf86cd799439011",
  selectedBed: { id: "A" },
  ...overrides,
});

describe("structured move-in readiness", () => {
  afterEach(() => jest.restoreAllMocks());

  function mockAssignments({ billStatus = "paid", remainingAmount = 0, branch = "gil-puyat", conflict = null } = {}) {
    jest.spyOn(Bill, "findById").mockReturnValue(queryResult({
      billType: "initial_payment",
      status: billStatus,
      remainingAmount,
    }));
    jest.spyOn(Room, "findById").mockReturnValue(queryResult({
      branch,
      beds: [{ id: "A" }],
    }));
    jest.spyOn(Stay, "findOne").mockReturnValue(queryResult(conflict));
    jest.spyOn(Reservation, "findOne").mockReturnValue(queryResult(null));
  }

  test("a paid zero-balance initial Bill clears the financial blockers", async () => {
    mockAssignments();
    await expect(getStructuredMoveInBlockers(readyReservation())).resolves.toEqual([]);
  });

  test.each([
    ["pending", 10600],
    ["partially-paid", 5600],
  ])("an unpaid %s initial Bill blocks move-in", async (billStatus, remainingAmount) => {
    mockAssignments({ billStatus, remainingAmount });
    await expect(getStructuredMoveInBlockers(readyReservation())).resolves.toContain(
      "Structured initial-payment Bill must be fully paid with zero remaining balance.",
    );
  });

  test("an active, unexpired approved exception can satisfy missing documents", async () => {
    mockAssignments();
    const reservation = readyReservation({
      selfiePhotoUrl: null,
      moveInException: {
        active: true,
        approvedBy: "507f1f77bcf86cd799439013",
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const blockers = await getStructuredMoveInBlockers(reservation);
    expect(blockers).not.toContain(
      "Required documents are incomplete and no active approved exception exists.",
    );
  });

  test("wrong-branch assignment and active Stay conflicts block move-in", async () => {
    mockAssignments({ branch: "guadalupe", conflict: { _id: "conflict" } });
    const blockers = await getStructuredMoveInBlockers(readyReservation());
    expect(blockers).toEqual(expect.arrayContaining([
      "Room assignment does not match the approved branch.",
      "A conflicting active Stay already uses this room or bed.",
    ]));
  });

  test("legacy occupants are not retroactively evaluated", async () => {
    await expect(getStructuredMoveInBlockers({ status: "moveIn" })).resolves.toEqual([]);
  });

  // Step 10 / CRITICAL check: a reservation where only the PHP 2,000
  // reservation fee has been verified (the GP-201 scenario from the QA
  // investigation) must NOT be treated as move-in ready — the structured
  // initial-payment Bill has not even been created yet.
  test("reservation-fee-only settlement (no initial-payment Bill yet) blocks move-in", async () => {
    mockAssignments();
    const feeOnlyReservation = readyReservation({
      initialPaymentBillId: null,
      initialPaymentStatus: "not_created",
    });
    const blockers = await getStructuredMoveInBlockers(feeOnlyReservation);
    expect(blockers).toContain("Structured initial-payment Bill is missing.");
  });

  // getStructuredMoveInReadinessSummary is the API-facing wrapper attached to
  // the reservation detail response as reservation.moveInReadiness — this is
  // the ONLY thing the frontend (reservationReadiness.js's
  // getMoveInReadinessLabel) is allowed to treat as authoritative for a
  // final "Move-in ready!" claim, so its contract needs its own coverage
  // beyond getStructuredMoveInBlockers's raw blocker-list assertions.
  describe("getStructuredMoveInReadinessSummary (API-facing wrapper)", () => {
    test("legacy (non-structured) reservation is not_applicable, not blocked", async () => {
      await expect(getStructuredMoveInReadinessSummary({ status: "moveIn" })).resolves.toEqual({
        status: "not_applicable",
        blockers: [],
      });
    });

    test("all blockers clear -> status ready with an empty blocker list", async () => {
      mockAssignments();
      await expect(
        getStructuredMoveInReadinessSummary(readyReservation()),
      ).resolves.toEqual({ status: "ready", blockers: [] });
    });

    test("any outstanding blocker -> status blocked, with the real blocker reasons surfaced", async () => {
      mockAssignments({ branch: "guadalupe", conflict: { _id: "conflict" } });
      const summary = await getStructuredMoveInReadinessSummary(readyReservation());
      expect(summary.status).toBe("blocked");
      expect(summary.blockers).toEqual(expect.arrayContaining([
        "Room assignment does not match the approved branch.",
        "A conflicting active Stay already uses this room or bed.",
      ]));
    });

    test("a conflicting active Reservation on the same room/bed blocks readiness even when documents/payment/pricing are otherwise complete", async () => {
      jest.spyOn(Bill, "findById").mockReturnValue(queryResult({
        billType: "initial_payment",
        status: "paid",
        remainingAmount: 0,
      }));
      jest.spyOn(Room, "findById").mockReturnValue(queryResult({
        branch: "gil-puyat",
        beds: [{ id: "A" }],
      }));
      jest.spyOn(Stay, "findOne").mockReturnValue(queryResult(null));
      jest.spyOn(Reservation, "findOne").mockReturnValue(queryResult({ _id: "other-reservation" }));

      const summary = await getStructuredMoveInReadinessSummary(readyReservation());
      expect(summary.status).toBe("blocked");
      expect(summary.blockers).toContain(
        "A conflicting active Reservation already uses this room or bed.",
      );
    });
  });
});
