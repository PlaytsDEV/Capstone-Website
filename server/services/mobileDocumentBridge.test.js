import { describe, expect, test } from "@jest/globals";
import { buildPolicyDocumentPdf, POLICY_DOCUMENT_IDS } from "./mobileDocumentBridge.js";

describe("mobileDocumentBridge", () => {
  test("serves real PDF bytes for every known static policy document id", () => {
    for (const docId of POLICY_DOCUMENT_IDS) {
      const buffer = buildPolicyDocumentPdf(docId);
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    }
  });

  test("exposes exactly the five keys the mobile frontend calls, never a per-user or contract id", () => {
    expect(POLICY_DOCUMENT_IDS).toEqual([
      "house_rules", "curfew_policy", "visitor_policy", "payment_terms", "emergency_procedures",
    ]);
    expect(POLICY_DOCUMENT_IDS).not.toContain("contract");
    expect(POLICY_DOCUMENT_IDS).not.toContain("valid_id");
  });

  test("returns null (never fabricated content) for an unknown docId", () => {
    expect(buildPolicyDocumentPdf("valid_id")).toBeNull();
    expect(buildPolicyDocumentPdf("contract")).toBeNull();
    expect(buildPolicyDocumentPdf("some-other-tenants-private-doc")).toBeNull();
  });
});
