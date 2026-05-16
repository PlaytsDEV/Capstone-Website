export function getPrecheckStatus(precheck = {}) {
 const explicitStatus = String(precheck?.precheckStatus || "").trim();
 if (explicitStatus && explicitStatus !== "not_checked") return explicitStatus;
 if (precheck?.aiCheckStatus === "passed") return "ready_for_submission";
 if (precheck?.aiCheckStatus === "failed" || precheck?.aiCheckStatus === "warning")
  return "needs_reupload";
 if (precheck?.aiCheckStatus === "error") return "manual_review_fallback";
 return "not_checked";
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
