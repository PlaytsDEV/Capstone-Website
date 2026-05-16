export function getPrecheckStatus(precheck = {}) {
 const explicitStatus = String(precheck?.precheckStatus || "").trim();
 if (explicitStatus && explicitStatus !== "not_checked") return explicitStatus;
 if (precheck?.aiCheckStatus === "passed") return "ready_for_submission";
 if (precheck?.aiCheckStatus === "failed" || precheck?.aiCheckStatus === "warning")
  return "needs_reupload";
 if (precheck?.aiCheckStatus === "error") return "manual_review_fallback";
 return "not_checked";
}

export const DOCUMENT_PRECHECK_MESSAGES = Object.freeze({
 checking: "Checking your document. Please wait.",
 passed: "Your document is clear and ready for review.",
 manualReview:
  "Your document was uploaded, but our staff needs to review it before approval.",
 blurry: "Your document is too blurry. Please upload a clearer photo.",
 cropped:
  "Some parts of your document are cut off. Please upload the complete document.",
 tooDark: "Your document is too dark. Please upload a brighter photo.",
 glare: "Your document is too bright or has glare. Please retake the photo.",
 wrongDocument:
  "This does not appear to be the required document. Please upload the correct document.",
 unsupportedFile:
  "This file type is not supported. Please upload a JPG, PNG, or PDF file.",
 failed:
  "We could not accept this document. Please upload a clearer and complete copy.",
 notChecked: "Please re-upload this document so we can check it properly.",
 checkingSubmit:
  "Please wait while we finish checking your uploaded documents.",
});

const collectCheckSignals = (precheck = {}) =>
 [
  precheck?.readabilityStatus,
  precheck?.documentTypeStatus,
  precheck?.applicantMessage,
  precheck?.summaryMessage,
  precheck?.adminNote,
  ...(Array.isArray(precheck?.flags) ? precheck.flags : []),
  ...(Array.isArray(precheck?.aiCheckWarnings) ? precheck.aiCheckWarnings : []),
 ]
  .filter(Boolean)
  .join(" ")
  .toLowerCase();

const includesAny = (value, tokens) =>
 tokens.some((token) => value.includes(token));

export function getApplicantDocumentPrecheckMessage(
 precheck = {},
 status = getPrecheckStatus(precheck),
) {
 if (status === "checking") return DOCUMENT_PRECHECK_MESSAGES.checking;
 if (status === "ready_for_submission") return DOCUMENT_PRECHECK_MESSAGES.passed;
 if (status === "manual_review_fallback" || status === "manual_review") {
  return DOCUMENT_PRECHECK_MESSAGES.manualReview;
 }
 if (status === "not_checked") return DOCUMENT_PRECHECK_MESSAGES.notChecked;

 const signals = collectCheckSignals(precheck);
 if (includesAny(signals, ["unsupported", "file type", "mime"])) {
  return DOCUMENT_PRECHECK_MESSAGES.unsupportedFile;
 }
 if (
  precheck?.documentTypeStatus === "possible_mismatch" ||
  includesAny(signals, ["mismatch", "wrong document", "incorrect document"])
 ) {
  return DOCUMENT_PRECHECK_MESSAGES.wrongDocument;
 }
 if (includesAny(signals, ["cropped", "cut off", "incomplete", "missing edge"])) {
  return DOCUMENT_PRECHECK_MESSAGES.cropped;
 }
 if (includesAny(signals, ["too dark", "dark", "underexposed"])) {
  return DOCUMENT_PRECHECK_MESSAGES.tooDark;
 }
 if (includesAny(signals, ["too bright", "bright", "glare", "overexposed"])) {
  return DOCUMENT_PRECHECK_MESSAGES.glare;
 }
 if (
  precheck?.readabilityStatus === "low_readability" ||
  precheck?.readabilityStatus === "unreadable" ||
  includesAny(signals, ["blurry", "blur", "unclear", "unreadable"])
 ) {
  return DOCUMENT_PRECHECK_MESSAGES.blurry;
 }

 return DOCUMENT_PRECHECK_MESSAGES.failed;
}

export function hasBlockingPrecheck(precheck = {}) {
 const status = getPrecheckStatus(precheck);
 if (status === "manual_review_fallback") return false;
 return (
  status === "needs_reupload" ||
  precheck?.readabilityStatus === "low_readability" ||
  precheck?.readabilityStatus === "unreadable" ||
  precheck?.documentTypeStatus === "possible_mismatch" ||
  precheck?.canSubmit === false
 );
}
