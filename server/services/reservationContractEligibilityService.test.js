import { describe, expect, test } from "@jest/globals";
import { resolveReservationContractEligibility } from "./reservationContractEligibilityService.js";

const modern = (overrides = {}) => ({
  status: "reserved",
  userId: "tenant-1",
  roomId: "room-1",
  selectedBed: { id: "bed-1" },
  moveInDate: new Date("2026-05-26"),
  paymentStatus: "paid",
  applicationReviewedAt: new Date("2026-05-01"),
  applicationReviewedBy: "admin-1",
  ...overrides,
});

describe("Reservation Contract eligibility", () => {
  test("explicit approved Reservation qualifies", () => {
    expect(resolveReservationContractEligibility(modern())).toMatchObject({
      eligible: true, approvalState: "approved", legacyCompatibilityApplied: false,
    });
  });

  test("pending Reservation remains blocked", () => {
    expect(resolveReservationContractEligibility(modern({
      status: "pending", applicationReviewedAt: null, applicationReviewedBy: null,
    }))).toMatchObject({ eligible: false, approvalState: "pending_review" });
  });

  test("rejected and cancelled Reservations remain blocked", () => {
    expect(resolveReservationContractEligibility(modern({ status: "rejected" })).approvalState)
      .toBe("rejected");
    expect(resolveReservationContractEligibility(modern({ status: "cancelled" })).eligible)
      .toBe(false);
  });

  test("complete moved-in legacy evidence qualifies without mutating the source", () => {
    const reservation = modern({
      status: "moveIn", applicationReviewedAt: null, applicationReviewedBy: null,
    });
    expect(resolveReservationContractEligibility(reservation)).toMatchObject({
      eligible: true, approvalState: "legacy_completed", legacyCompatibilityApplied: true,
    });
    expect(reservation.applicationReviewedAt).toBeNull();
  });

  test("incomplete moved-in evidence is inconsistent", () => {
    const result = resolveReservationContractEligibility(modern({
      status: "moveIn", applicationReviewedAt: null, applicationReviewedBy: null,
      paymentStatus: "pending", selectedBed: {},
    }));
    expect(result).toMatchObject({
      eligible: false,
      approvalState: "inconsistent",
      blockers: [{ code: "RESERVATION_LEGACY_VERIFICATION_REQUIRED" }],
    });
  });
});
