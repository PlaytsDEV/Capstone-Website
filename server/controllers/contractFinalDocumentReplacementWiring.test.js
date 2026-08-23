import fs from "fs";
import path from "path";
import { describe, expect, test } from "@jest/globals";

// Regression coverage for the final-contract-document replacement process —
// the "formal process" that FINAL_DOCUMENT_REPLACEMENT_REQUIRES_FORMAL_PROCESS
// (contractSigningService.uploadSignedContract,
// contractNotarizationService.assertDirectUploadAllowed) blocks admins into,
// but which previously did not exist anywhere in the codebase: once a
// contract's finalDocument was set, there was no way to correct a wrong
// upload short of a manual database edit.

const controller = fs.readFileSync(path.resolve("controllers/contractController.js"), "utf8");
const routes = fs.readFileSync(path.resolve("routes/contractRoutes.js"), "utf8");
const replacementService = fs.readFileSync(
  path.resolve("services/contractFinalDocumentReplacementService.js"),
  "utf8",
);
const contractModel = fs.readFileSync(path.resolve("models/Contract.js"), "utf8");

describe("final document replacement wiring", () => {
  test("route requires owner-level auth and a file upload", () => {
    expect(routes).toMatch(
      /router\.post\("\/:id\/documents\/final\/replace",\s*verifyOwner,\s*signedUpload\.single\("file"\),\s*replaceFinalDocument\)/,
    );
    expect(routes).toContain('router.get("/:id/documents/final/history", getFinalDocumentHistory)');
  });

  test("controller requires an explicit confirmation flag, like every other consequential document mutation", () => {
    const start = controller.indexOf("export const replaceFinalDocument");
    const end = controller.indexOf("export const getFinalDocumentHistory");
    const body = controller.slice(start, end);
    expect(body).toMatch(/confirmed\s*!==\s*true/);
    expect(body).toContain("FINAL_DOCUMENT_REPLACEMENT_CONFIRMATION_REQUIRED");
  });

  test("controller fires the tenant contractDocumentReady notification on success, non-fatally", () => {
    const start = controller.indexOf("export const replaceFinalDocument");
    const end = controller.indexOf("export const getFinalDocumentHistory");
    const body = controller.slice(start, end);
    expect(body).toContain(".contractDocumentReady(");
    expect(body).toContain('"final"');
    expect(body).toContain("result.finalDocument?.sourceVersion");
    expect(body).not.toContain("result.finalDocument?.version)");
    expect(body).toMatch(/\.catch\(/);
  });

  test("service requires a finalDocument to already exist and a non-empty replacement reason", () => {
    expect(replacementService).toContain("NO_FINAL_DOCUMENT_TO_REPLACE");
    expect(replacementService).toContain("FINAL_DOCUMENT_REPLACEMENT_REASON_REQUIRED");
  });

  test("service preserves the superseded final document in finalDocumentHistory rather than discarding it", () => {
    expect(replacementService).toContain("contract.finalDocumentHistory");
    expect(replacementService).toContain("supersededAt");
    expect(replacementService).toContain("supersededBy");
  });

  test("service rolls back the newly stored file if the contract save fails (atomic replacement)", () => {
    const start = replacementService.indexOf("try {");
    const end = replacementService.indexOf("return {");
    const body = replacementService.slice(start, end);
    expect(body).toContain("catch (saveError)");
    expect(body).toContain("removeSignedContractDocument");
  });

  test("model carries a version-tagged finalDocumentHistory array alongside finalDocument", () => {
    expect(contractModel).toContain("finalDocumentHistory");
    expect(contractModel).toContain("finalDocumentHistoryEntrySchema");
  });
});
