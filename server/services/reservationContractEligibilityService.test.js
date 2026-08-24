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

  test("an otherwise-approved Reservation with an open cancellation request is not eligible", () => {
    const result = resolveReservationContractEligibility(modern({
      cancellationRequested: true, cancellationStatus: "pending",
    }));
    expect(result).toMatchObject({
      eligible: false,
      approvalState: "cancellation_pending",
      blockers: [{
        code: "RESERVATION_CANCELLATION_PENDING",
        category: "PENDING_CANCELLATION",
        retryable: false,
        humanActionRequired: true,
      }],
    });
  });

  test("a resolved (approved/rejected) cancellation request no longer blocks eligibility", () => {
    const approved = resolveReservationContractEligibility(modern({
      cancellationRequested: true, cancellationStatus: "approved",
    }));
    expect(approved.eligible).toBe(true);

    const rejected = resolveReservationContractEligibility(modern({
      cancellationRequested: true, cancellationStatus: "rejected",
    }));
    expect(rejected.eligible).toBe(true);
  });

  // Case A — Private without bed: eligible.
  test("approved Private reservation qualifies with no bed assignment", () => {
    const result = resolveReservationContractEligibility(
      modern({ selectedBed: {} }),
      { roomType: "private", bedExists: false },
    );
    expect(result).toMatchObject({ eligible: true, approvalState: "approved" });
    expect(result.sourceEvidence.bedRequired).toBe(false);
  });

  // Case B — Private eligibility must not depend on stale/irrelevant bed
  // metadata one way or the other: present or absent, it never matters.
  test("approved Private reservation qualifies the same way whether or not irrelevant bed metadata is present", () => {
    const withoutBed = resolveReservationContractEligibility(
      modern({ selectedBed: {} }),
      { roomType: "private", bedExists: false },
    );
    const withStaleBed = resolveReservationContractEligibility(
      modern({ selectedBed: { id: "bed-2", code: "leftover-stale-value" } }),
      { roomType: "private", bedExists: true },
    );
    expect(withoutBed).toMatchObject({ eligible: true, approvalState: "approved" });
    expect(withStaleBed).toMatchObject({ eligible: true, approvalState: "approved" });
  });

  // Case C — Double/Shared with a valid canonical bed: eligible.
  test("approved Double-sharing reservation qualifies once a bed is assigned", () => {
    const result = resolveReservationContractEligibility(
      modern(),
      { roomType: "double-sharing", bedExists: true },
    );
    expect(result).toMatchObject({ eligible: true, approvalState: "approved" });
    expect(result.sourceEvidence.bedRequired).toBe(true);
  });

  // Case D — Double/Shared without a bed: blocked, not fabricated.
  test("approved Double-sharing reservation with no bed assignment is blocked with a clear, retryable blocker (no bed fabricated)", () => {
    const result = resolveReservationContractEligibility(
      modern({ selectedBed: {} }),
      { roomType: "double-sharing", bedExists: false },
    );
    expect(result).toMatchObject({
      eligible: false,
      approvalState: "bed_assignment_required",
      blockers: [{
        code: "RESERVATION_BED_ASSIGNMENT_REQUIRED",
        retryable: true,
        humanActionRequired: true,
      }],
    });
    expect(result.sourceEvidence.bedRequired).toBe(true);
  });

  // Case E — Quadruple with a valid bed: eligible.
  test("approved Quadruple-sharing reservation qualifies once a bed is assigned", () => {
    const result = resolveReservationContractEligibility(
      modern(),
      { roomType: "quadruple-sharing", bedExists: true },
    );
    expect(result).toMatchObject({ eligible: true, approvalState: "approved" });
  });

  // Case F — Quadruple without a bed: blocked, not fabricated.
  test("approved Quadruple-sharing reservation with no bed assignment is blocked with a clear, retryable blocker (no bed fabricated)", () => {
    const result = resolveReservationContractEligibility(
      modern({ selectedBed: {} }),
      { roomType: "quadruple-sharing", bedExists: false },
    );
    expect(result).toMatchObject({
      eligible: false,
      approvalState: "bed_assignment_required",
      blockers: [{
        code: "RESERVATION_BED_ASSIGNMENT_REQUIRED",
        retryable: true,
        humanActionRequired: true,
      }],
    });
    expect(result.sourceEvidence.bedRequired).toBe(true);
  });

  // Case G — stale reservation.preferredRoomType must never override the
  // authoritative assigned Room type passed in context.roomType. This is
  // the exact defect confirmed in three historical contracts where
  // preferredRoomType said "quadruple" but the actual assigned Room was
  // private.
  test("authoritative context.roomType wins over a stale reservation.preferredRoomType (private room, quadruple-labeled preference)", () => {
    const result = resolveReservationContractEligibility(
      modern({ selectedBed: {}, preferredRoomType: "quadruple-sharing" }),
      { roomType: "private", bedExists: false },
    );
    expect(result).toMatchObject({ eligible: true, approvalState: "approved" });
    expect(result.sourceEvidence.bedRequired).toBe(false);
  });

  test("authoritative context.roomType wins over a stale reservation.preferredRoomType (double room, private-labeled preference)", () => {
    const result = resolveReservationContractEligibility(
      modern({ selectedBed: {}, preferredRoomType: "private" }),
      { roomType: "double-sharing", bedExists: false },
    );
    expect(result).toMatchObject({
      eligible: false,
      approvalState: "bed_assignment_required",
      blockers: [{ code: "RESERVATION_BED_ASSIGNMENT_REQUIRED" }],
    });
    expect(result.sourceEvidence.bedRequired).toBe(true);
  });

  test("an unknown/unrecognized room type fails safe and still requires a bed", () => {
    const result = resolveReservationContractEligibility(
      modern({ selectedBed: {} }),
      { roomType: "some-future-room-type", bedExists: false },
    );
    expect(result.sourceEvidence.bedRequired).toBe(true);
    expect(result.eligible).toBe(false);
  });
});
