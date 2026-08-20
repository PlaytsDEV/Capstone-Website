import { describe, expect, test } from "@jest/globals";
import {
  isResidentContractEligible,
  selectCanonicalTenantContract,
} from "./tenantContractSelectionService.js";

const contract = (overrides = {}) => ({
  _id: overrides._id || "contract-1",
  tenantId: "tenant-1",
  reservationId: "reservation-1",
  stayId: "stay-1",
  status: "generated",
  isCurrent: true,
  isCanonical: true,
  publicationStatus: "ready_for_resident",
  preparedDocuments: [{ version: 1, superseded: false }],
  ...overrides,
});
const activeStay = { _id: "stay-1", reservationId: "reservation-1" };

describe("resident canonical Contract selection", () => {
  test("returns one canonical prepared Contract", () => {
    expect(selectCanonicalTenantContract({ contracts: [contract()], activeStay })?._id)
      .toBe("contract-1");
  });

  test("ignores a newer needs-attention duplicate", () => {
    const selected = selectCanonicalTenantContract({
      contracts: [
        contract({ _id: "canonical" }),
        contract({
          _id: "duplicate",
          status: "incomplete",
          duplicateOfContractId: "canonical",
          isCanonical: false,
          publicationStatus: "internal",
        }),
      ],
      activeStay,
    });
    expect(selected._id).toBe("canonical");
  });

  test("does not expose an internal incomplete Contract", () => {
    expect(selectCanonicalTenantContract({
      contracts: [contract({ status: "incomplete", publicationStatus: "internal" })],
      activeStay,
    })).toBeNull();
  });

  test.each([
    { status: "voided" },
    { status: "cancelled" },
    { status: "rejected" },
    { duplicateOfContractId: "contract-0", isCanonical: false },
    { supersededByContractId: "contract-2", isCurrent: false },
  ])("excludes invalid primary Contract %#", (overrides) => {
    expect(isResidentContractEligible(contract(overrides))).toBe(false);
  });

  test("returns a safe integrity conflict for multiple canonical candidates", () => {
    expect(() => selectCanonicalTenantContract({
      contracts: [contract({ _id: "one" }), contract({ _id: "two" })],
      activeStay,
    })).toThrow(expect.objectContaining({
      code: "MULTIPLE_CANONICAL_CONTRACTS",
      statusCode: 409,
    }));
  });

  test("prefers the Contract linked to the active stay over an older stay", () => {
    const selected = selectCanonicalTenantContract({
      contracts: [
        contract({ _id: "old", stayId: "stay-old", reservationId: "reservation-old" }),
        contract({ _id: "current" }),
      ],
      activeStay,
    });
    expect(selected._id).toBe("current");
  });

  test("selects an active renewal while the prior Contract is superseded", () => {
    const selected = selectCanonicalTenantContract({
      contracts: [
        contract({
          _id: "previous",
          status: "renewed",
          isCurrent: false,
          supersededByContractId: "renewal",
        }),
        contract({ _id: "renewal", contractPurpose: "renewal" }),
      ],
      activeStay,
    });
    expect(selected._id).toBe("renewal");
  });

  test("a not-yet-effective renewal successor never outranks its still-active predecessor, even when it already carries the new (already-swapped) Stay's stayId", () => {
    // Reproduces the exact scenario found during Phase 2 research:
    // renewStayWorkflow swaps the active Stay immediately at acceptance,
    // before the new lease even starts, so a freshly-generated renewal
    // successor Contract can carry the *new* Stay's stayId (rank 400)
    // while its predecessor only matches by reservationId (rank 300) —
    // without the fix, the not-yet-effective successor would win.
    const selected = selectCanonicalTenantContract({
      contracts: [
        contract({ _id: "current", status: "active" }),
        contract({
          _id: "renewal-successor",
          contractPurpose: "renewal",
          replacesContractId: "current",
          status: "published",
          stayId: "stay-1", // matches activeStay — would otherwise rank 400
          leaseStartDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        }),
      ],
      activeStay,
      now: new Date(),
    });
    expect(selected._id).toBe("current");
  });

  test("a renewal successor whose effective date has already arrived is eligible to be selected (post-activation, isCurrent already flipped)", () => {
    const selected = selectCanonicalTenantContract({
      contracts: [
        contract({ _id: "old", status: "replaced", isCurrent: false, supersededByContractId: "renewal-successor" }),
        contract({
          _id: "renewal-successor",
          contractPurpose: "renewal",
          replacesContractId: "old",
          status: "active",
          leaseStartDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        }),
      ],
      activeStay: { _id: "stay-1", reservationId: "reservation-1" },
      now: new Date(),
    });
    expect(selected._id).toBe("renewal-successor");
  });

  test("keeps legacy generated Contracts visible without exposing legacy drafts", () => {
    expect(isResidentContractEligible(contract({ publicationStatus: undefined }))).toBe(true);
    expect(isResidentContractEligible(contract({
      status: "draft",
      publicationStatus: undefined,
    }))).toBe(false);
  });

  test("draft/incomplete/ready_for_generation stay invisible by default (unchanged Web behavior)", () => {
    for (const status of ["draft", "incomplete", "ready_for_generation"]) {
      expect(isResidentContractEligible(contract({ status, publicationStatus: undefined }))).toBe(false);
    }
  });

  test("includeEarlyStages surfaces a fresh draft Contract for the tenant that owns it (mobile-only opt-in)", () => {
    for (const status of ["draft", "incomplete", "ready_for_generation"]) {
      expect(isResidentContractEligible(
        contract({ status, publicationStatus: undefined }),
        { includeEarlyStages: true },
      )).toBe(true);
    }
  });

  test("includeEarlyStages does not weaken ownership/withdrawal/archival guards", () => {
    expect(isResidentContractEligible(
      contract({ status: "draft", archivedAt: new Date() }),
      { includeEarlyStages: true },
    )).toBe(false);
    expect(isResidentContractEligible(
      contract({ status: "draft", isCurrent: false }),
      { includeEarlyStages: true },
    )).toBe(false);
    expect(isResidentContractEligible(
      contract({ status: "draft", publicationStatus: "withdrawn" }),
      { includeEarlyStages: true },
    )).toBe(false);
    expect(isResidentContractEligible(
      contract({ status: "draft", duplicateOfContractId: "canonical" }),
      { includeEarlyStages: true },
    )).toBe(false);
  });

  test("selectCanonicalTenantContract with includeEarlyStages returns the tenant's own draft Contract", () => {
    const selected = selectCanonicalTenantContract({
      contracts: [contract({ _id: "draft-1", status: "draft", publicationStatus: undefined })],
      activeStay,
      includeEarlyStages: true,
    });
    expect(selected?._id).toBe("draft-1");
  });

  test("selectCanonicalTenantContract without includeEarlyStages still hides the same draft Contract (Web unaffected)", () => {
    const selected = selectCanonicalTenantContract({
      contracts: [contract({ _id: "draft-1", status: "draft", publicationStatus: undefined })],
      activeStay,
    });
    expect(selected).toBeNull();
  });

  test("archived metadata excludes a record even when its stale status is resident-visible", () => {
    expect(selectCanonicalTenantContract({
      contracts: [contract({ status: "generated", archivedAt: new Date() })],
      activeStay,
    })).toBeNull();
  });

  // Reproduces the production mobile/web discrepancy where the tenant's
  // admin-visible "Verified Active Stay" Contract (dates, room, PDF) was
  // authoritative, but the mobile app still showed "Preparing Contract" with
  // different (stale) dates for the same tenant. Root cause: a pre-generation
  // draft Contract created at reservation time inherits the active Stay's
  // stayId (relationshipRank 400); the later, fully-generated/active Contract
  // for the same stay is only linked by reservationId (rank 300) because its
  // stayId was never backfilled. Ranking by relationship strength alone let
  // the stale draft outrank the real, tenant-visible Contract whenever
  // includeEarlyStages is true (mobile's opt-in) — exactly reproducing wrong
  // dates and a false "Preparing" state despite a real PDF existing.
  test("a stale early-stage draft must never outrank a later fully-generated Contract for the same stay", () => {
    const staleDraft = contract({
      _id: "draft-old",
      status: "draft",
      publicationStatus: undefined,
      stayId: "stay-1",
      leaseStartDate: "2026-09-13",
      leaseEndDate: "2027-09-13",
    });
    const correctedActive = contract({
      _id: "active-new",
      status: "active",
      publicationStatus: "published",
      tenantVisible: true,
      stayId: null,
      leaseStartDate: "2026-08-12",
      leaseEndDate: "2027-09-12",
    });
    const selected = selectCanonicalTenantContract({
      contracts: [staleDraft, correctedActive],
      activeStay,
      includeEarlyStages: true,
    });
    expect(selected?._id).toBe("active-new");
  });

  test("among Contracts of the same tier, relationship strength still decides (unchanged)", () => {
    const selected = selectCanonicalTenantContract({
      contracts: [
        contract({ _id: "old", stayId: "stay-old", reservationId: "reservation-old" }),
        contract({ _id: "current", stayId: "stay-1" }),
      ],
      activeStay,
    });
    expect(selected._id).toBe("current");
  });
});
