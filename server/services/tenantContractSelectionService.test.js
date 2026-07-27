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

  test("keeps legacy generated Contracts visible without exposing legacy drafts", () => {
    expect(isResidentContractEligible(contract({ publicationStatus: undefined }))).toBe(true);
    expect(isResidentContractEligible(contract({
      status: "draft",
      publicationStatus: undefined,
    }))).toBe(false);
  });
});
