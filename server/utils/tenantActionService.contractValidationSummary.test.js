/**
 * Unit coverage for `summarizeContractValidationGaps` — the helper that turns
 * a `validateContractForGeneration` result into the human-readable reason
 * embedded in the ROOM_TRANSFER_CONTRACT_INCOMPLETE (422) error.
 *
 * Regression: the previous code did `validation.missingFields.join(", ")` on
 * an array of `{ field, label }` objects, so the API surfaced
 * "...for generation: [object Object]. Complete it in the Contracts
 * workspace...". This does NOT touch validation itself — the backend still
 * rejects an incomplete/malformed transfer; only the message text changed.
 */
import { describe, expect, test } from "@jest/globals";

import { summarizeContractValidationGaps } from "./tenantActionService.js";

describe("summarizeContractValidationGaps", () => {
  test("renders missing fields by their human-readable label", () => {
    const summary = summarizeContractValidationGaps({
      missingFields: [
        { field: "bedId", label: "Bed or slot" },
        { field: "tenantBirthDate", label: "Tenant birth date" },
      ],
      errors: [],
    });
    expect(summary).toBe("Bed or slot, Tenant birth date");
    expect(summary).not.toMatch(/\[object Object\]/);
  });

  test("the classic missing-bed case reads 'Bed or slot', never '[object Object]'", () => {
    const summary = summarizeContractValidationGaps({
      missingFields: [{ field: "bedId", label: "Bed or slot" }],
    });
    expect(summary).toBe("Bed or slot");
    const fullMessage =
      "The room-transfer replacement Contract could not be auto-completed for generation: " +
      summary +
      ". Complete it in the Contracts workspace, then retry the transfer.";
    expect(fullMessage).not.toContain("[object Object]");
    expect(fullMessage).toContain("Bed or slot");
  });

  test("falls back to the field name when a missing field has no label", () => {
    expect(
      summarizeContractValidationGaps({ missingFields: [{ field: "roomNumber" }] }),
    ).toBe("roomNumber");
  });

  test("falls back to validation error messages when there are no missing fields", () => {
    const summary = summarizeContractValidationGaps({
      missingFields: [],
      errors: [
        { code: "CONTRACT_GENERATION_DATA_INVALID", message: "Destination room pricing could not be resolved." },
      ],
    });
    expect(summary).toBe("Destination room pricing could not be resolved.");
    expect(summary).not.toMatch(/\[object Object\]/);
  });

  test("uses an error code when the error has no message", () => {
    expect(
      summarizeContractValidationGaps({ errors: [{ code: "TENANT_LEGAL_AGE_REQUIRED" }] }),
    ).toBe("TENANT_LEGAL_AGE_REQUIRED");
  });

  test("missing fields win over error messages when both are present", () => {
    expect(
      summarizeContractValidationGaps({
        missingFields: [{ field: "bedId", label: "Bed or slot" }],
        errors: [{ message: "some other problem" }],
      }),
    ).toBe("Bed or slot");
  });

  test("tolerates plain-string entries", () => {
    expect(
      summarizeContractValidationGaps({ missingFields: ["Bed or slot", "Room number"] }),
    ).toBe("Bed or slot, Room number");
  });

  test("generic fallback when nothing actionable is present", () => {
    expect(summarizeContractValidationGaps({})).toBe("missing required data");
    expect(summarizeContractValidationGaps({ missingFields: [], errors: [] })).toBe(
      "missing required data",
    );
    expect(summarizeContractValidationGaps()).toBe("missing required data");
  });
});
