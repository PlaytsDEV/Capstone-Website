import fs from "fs";
import { describe, expect, test } from "@jest/globals";

const source = fs.readFileSync(new URL("./contractController.js", import.meta.url), "utf8");
const pdfSource = fs.readFileSync(
  new URL("../services/contractPdfService.js", import.meta.url),
  "utf8",
);
const publicationSource = fs.readFileSync(
  new URL("../services/contractPublicationService.js", import.meta.url),
  "utf8",
);

describe("secure prepared Contract responses", () => {
  test("admin and tenant streams prevent stale PDF caching", () => {
    expect(source.match(/Cache-Control", "private, no-store"/g)).toHaveLength(8);
    expect(source.match(/Pragma", "no-cache"/g)).toHaveLength(6);
  });

  test("tenant stream delegates current-version selection to the canonical resolver", () => {
    expect(source).toMatch(/selectCurrentPreparedDocument\(contract\)/);
    expect(source).toMatch(/resolveCurrentPreparedDocument\(contract\)/);
    expect(source).toMatch(/PREPARED_DOCUMENT_UNAVAILABLE/);
  });

  test("contract detail response uses the same workflow-aware verification as generation", () => {
    // The reservation lookup must fetch the fields needed to distinguish a
    // structured reservation from a legacy one — not just the legacy
    // paymentStatus field — otherwise the displayed summary can disagree
    // with the generation gate in contractGenerationDataService.js.
    expect(source).toMatch(
      /\.select\("reservationFeeAmount paymentStatus financialWorkflowVersion reservationFeePaymentStatus"\)/,
    );
    expect(source).toMatch(/financialWorkflowVersion:\s*reservation\?\.financialWorkflowVersion/);
    expect(source).toMatch(/reservationFeePaymentStatus:\s*reservation\?\.reservationFeePaymentStatus/);
  });

  test("document-ready notifications follow the canonical prepared and final writes", () => {
    const preparedStart = source.indexOf("export const generatePreparedContract");
    const preparedEnd = source.indexOf("export const streamPreparedContract", preparedStart);
    const preparedFlow = source.slice(preparedStart, preparedEnd);
    expect(preparedFlow.indexOf("await generatePreparedContractPdf")).toBeGreaterThan(-1);
    expect(preparedFlow.indexOf(".contractDocumentReady(")).toBeGreaterThan(
      preparedFlow.indexOf("await generatePreparedContractPdf"),
    );
    expect(preparedFlow).toMatch(/document\.version/);

    const finalStart = source.indexOf("export const publishContract");
    const finalEnd = source.indexOf("const streamFinal", finalStart);
    const finalFlow = source.slice(finalStart, finalEnd);
    expect(finalFlow.indexOf("await publishFinalContract")).toBeGreaterThan(-1);
    expect(finalFlow.indexOf(".contractDocumentReady(")).toBeGreaterThan(
      finalFlow.indexOf("await publishFinalContract"),
    );
    expect(finalFlow).toMatch(/finalDocument\?\.sourceVersion/);
  });

  test("both current-contract endpoints embed the ONE canonical acknowledgement state", () => {
    // Tenant endpoint: getMyCurrentContract resolves the canonical
    // acknowledgement state from the already-loaded contract (no extra read)
    // and passes it through toTenantContractView.
    const tenantStart = source.indexOf("export const getMyCurrentContract");
    const tenantEnd = source.indexOf("export const downloadMyStayProof", tenantStart);
    const tenantFlow = source.slice(tenantStart, tenantEnd);
    expect(tenantFlow).toMatch(/getAcknowledgementStatusForContract\(contract, user\._id\)/);
    expect(tenantFlow).toMatch(/toTenantContractView\(contract, new Date\(\), \{[\s\S]*acknowledgement,[\s\S]*\}\)/);

    // Admin endpoint: getTenantCurrentContract resolves the SAME service and
    // merges it into the contract payload.
    const adminStart = source.indexOf("export const getTenantCurrentContract");
    const adminEnd = source.indexOf("const tenantActor", adminStart);
    const adminFlow = source.slice(adminStart, adminEnd);
    expect(adminFlow).toMatch(/getAcknowledgementStatusForContract\(contract, contract\.tenantId\)/);
    // Merges the canonical acknowledgement + signed-scan identity (and a
    // normalized `id`) into the raw contract payload.
    expect(adminFlow).toMatch(/\{ \.\.\.contractPayload, id: String\(contract\._id\), acknowledgement, signedScan \}/);

    // The synthetic (Stay-derived, no Contract row) branch must NOT advertise
    // a canonical PDF or an acknowledgement requirement.
    const syntheticStart = source.indexOf("STAY_PROOF_AVAILABLE");
    const syntheticFlow = source.slice(syntheticStart, syntheticStart + 2600);
    expect(syntheticFlow).toMatch(/isSynthetic: true/);
    expect(syntheticFlow).toMatch(/acknowledgement: \{\s*\n\s*required: false/);
  });

  test("both production notification call sites receive deterministic positive document versions", () => {
    expect(pdfSource).toMatch(
      /const generatedVersion = Math\.max\([\s\S]*preparedDocuments[\s\S]*\) \+ 1;/,
    );
    expect(source).toMatch(
      /contractDocumentReady\(result\.contract\.tenantId, "prepared", result\.contract\._id, document\.version\)/,
    );
    expect(publicationSource).toMatch(
      /sourceVersion: source\.document\.version/,
    );
    expect(source).toMatch(
      /contractDocumentReady\(contract\.tenantId, "final", contract\._id, contract\.finalDocument\?\.sourceVersion\)/,
    );
  });
});
