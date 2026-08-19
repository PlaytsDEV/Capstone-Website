import fs from "fs";
import path from "path";
import { describe, expect, test } from "@jest/globals";

// Regression coverage for the one-step "upload final notarized contract"
// finalize path (uploadFinalNotarizedContract / uploadAndFinalizeNotarizedContract).
//
// This is now the primary, canonical finalize action — the older multi-step
// verify -> mark-ready -> publish workflow (publishContract) already sends
// notify.contractDocumentReady() and requires an explicit `confirmed: true`
// body flag (see contractPublicationWiring.test.js). This one-step path had
// neither: it silently finalized/activated a contract with no tenant
// notification and no explicit confirmation gate, unlike every other
// consequential mutation in this controller.

const controller = fs.readFileSync(path.resolve("controllers/contractController.js"), "utf8");
const notarizationService = fs.readFileSync(
  path.resolve("services/contractNotarizationService.js"),
  "utf8",
);

describe("one-step final notarized upload wiring", () => {
  test("requires an explicit confirmation flag before finalizing, like publishContract/readyContractForPublication", () => {
    const start = controller.indexOf("export const uploadFinalNotarizedContract");
    const end = controller.indexOf("export const streamNotarizedDocument");
    const body = controller.slice(start, end);
    expect(body).toMatch(/confirmed\s*!==\s*true/);
    expect(body).toContain("PUBLICATION_CONFIRMATION_REQUIRED");
  });

  test("fires the tenant contractDocumentReady notification on success, same as publishContract", () => {
    const start = controller.indexOf("export const uploadFinalNotarizedContract");
    const end = controller.indexOf("export const streamNotarizedDocument");
    const body = controller.slice(start, end);
    expect(body).toContain("notify");
    expect(body).toContain(".contractDocumentReady(");
    expect(body).toContain('"final"');
    // The push/notification side effect must never be able to roll back
    // the already-committed contract state or fail the HTTP response.
    expect(body).toMatch(/\.catch\(/);
  });

  test("a published/active final document cannot be silently replaced by a repeat one-step upload", () => {
    expect(notarizationService).toContain("FINAL_DOCUMENT_REPLACEMENT_REQUIRES_FORMAL_PROCESS");
    expect(notarizationService).toContain("contract.finalStorageKey || contract.publishedAt");
  });
});
