import test from "node:test";
import assert from "node:assert/strict";

import {
  DOCUMENT_PRECHECK_MESSAGES,
  getApplicantDocumentPrecheckMessage,
  hasBlockingPrecheck,
} from "./documentPrecheckUtils.js";

test("document precheck messages stay applicant-friendly", () => {
  assert.equal(
    getApplicantDocumentPrecheckMessage({ precheckStatus: "checking" }),
    DOCUMENT_PRECHECK_MESSAGES.checking,
  );
  assert.equal(
    getApplicantDocumentPrecheckMessage({
      precheckStatus: "ready_for_submission",
    }),
    DOCUMENT_PRECHECK_MESSAGES.passed,
  );
  assert.equal(
    getApplicantDocumentPrecheckMessage({
      precheckStatus: "manual_review_fallback",
    }),
    DOCUMENT_PRECHECK_MESSAGES.manualReview,
  );
  assert.equal(
    getApplicantDocumentPrecheckMessage({
      precheckStatus: "not_checked",
    }),
    DOCUMENT_PRECHECK_MESSAGES.notChecked,
  );
});

test("document precheck failure reasons map to formal applicant guidance", () => {
  assert.equal(
    getApplicantDocumentPrecheckMessage({
      precheckStatus: "needs_reupload",
      readabilityStatus: "low_readability",
    }),
    DOCUMENT_PRECHECK_MESSAGES.blurry,
  );
  assert.equal(
    getApplicantDocumentPrecheckMessage({
      precheckStatus: "needs_reupload",
      flags: ["cropped"],
    }),
    DOCUMENT_PRECHECK_MESSAGES.cropped,
  );
  assert.equal(
    getApplicantDocumentPrecheckMessage({
      precheckStatus: "needs_reupload",
      flags: ["underexposed"],
    }),
    DOCUMENT_PRECHECK_MESSAGES.tooDark,
  );
  assert.equal(
    getApplicantDocumentPrecheckMessage({
      precheckStatus: "needs_reupload",
      flags: ["glare"],
    }),
    DOCUMENT_PRECHECK_MESSAGES.glare,
  );
  assert.equal(
    getApplicantDocumentPrecheckMessage({
      precheckStatus: "needs_reupload",
      documentTypeStatus: "possible_mismatch",
    }),
    DOCUMENT_PRECHECK_MESSAGES.wrongDocument,
  );
  assert.equal(
    getApplicantDocumentPrecheckMessage({
      precheckStatus: "needs_reupload",
      flags: ["unsupported file type"],
    }),
    DOCUMENT_PRECHECK_MESSAGES.unsupportedFile,
  );
});

test("hasBlockingPrecheck always returns false to prevent AI blocking of application form submissions", () => {
  assert.equal(
    hasBlockingPrecheck({ precheckStatus: "manual_review_fallback" }),
    false,
  );
  assert.equal(
    hasBlockingPrecheck({ precheckStatus: "needs_reupload" }),
    false,
  );
  assert.equal(
    hasBlockingPrecheck({
      precheckStatus: "ready_for_submission",
      canSubmit: false,
    }),
    false,
  );
});
