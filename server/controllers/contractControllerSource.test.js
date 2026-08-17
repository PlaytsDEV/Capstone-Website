import fs from "fs";
import { describe, expect, test } from "@jest/globals";

const source = fs.readFileSync(new URL("./contractController.js", import.meta.url), "utf8");

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
});
