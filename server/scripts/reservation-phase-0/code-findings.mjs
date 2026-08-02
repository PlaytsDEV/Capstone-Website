export const CODE_FINDINGS = Object.freeze([
  { finding: "checkAndReleaseExpiredPaymentHolds exists", status: "Still present", evidence: ["server/services/paymentExpirationService.js:11"] },
  { finding: "Payment-hold expiration service scheduler registration", status: "Still present", detail: "The service is not imported or registered by startScheduler.", evidence: ["server/services/paymentExpirationService.js:11", "server/utils/scheduler.js:1020"] },
  { finding: "Contract drafting checks paymentStatus", status: "Partially fixed", detail: "Eligibility records payment status and legacy completion requires partial/paid, but explicit approved statuses can be eligible without a paid check.", evidence: ["server/services/reservationContractEligibilityService.js:21", "server/services/reservationContractEligibilityService.js:34"] },
  { finding: "getMoveInBlockers checks for a Contract", status: "Still present", detail: "It checks reserved status and paid payment state only.", evidence: ["server/utils/reservationHelpers.js:93"] },
  { finding: "Contract pricing uses live Room pricing", status: "Still present", detail: "Draft creation resolves regular pricing from the current Room document while the approved rate comes from the Reservation snapshot.", evidence: ["server/services/contractService.js:183", "server/services/contractPricingResolver.js:16"] },
  { finding: "Contract-pricing approval hardcodes PHP 2,000", status: "Still present", detail: "Approval rejects reservationFeeAmount values other than 2,000, and template validation repeats that assumption.", evidence: ["server/services/contractService.js:451", "server/services/contractTemplateService.js:168"] },
  { finding: "0% discount is rejected", status: "Still present", evidence: ["server/services/contractService.js:444"] },
  { finding: "Short-term room-price edits are ignored", status: "Still present", detail: "The resolver reads regularShortRate, but that field is not declared on the strict Room schema and therefore is not a durable model field.", evidence: ["server/services/contractPricingResolver.js:32", "server/models/Room.js:89"] },
  { finding: "Room schema lacks regularLongRate and regularShortRate", status: "Still present", detail: "Application code reads both, but the current Room schema declares shortTermRate instead.", evidence: ["server/models/Room.js:89", "server/controllers/reservations/_helpers.js:1300"] },
  { finding: "Advance rent and security deposit have a Payment or Bill path", status: "Partially fixed", detail: "Contract amounts exist, but Payment purpose and Bill type enums have no dedicated advance-rent or security-deposit classification. Actual manual/legacy record evidence remains unavailable until a safe database can be inspected.", evidence: ["server/models/Payment.js:52", "server/models/Bill.js:357", "server/models/Contract.js:176"] },
  { finding: "Two penalty engines coexist", status: "Still present", evidence: ["server/services/penaltyEngineService.js:1", "server/services/billing/penaltyCalculator.js:1"] },
  { finding: "Nightly penalty engine has tests", status: "Partially fixed", detail: "Scheduler penalty behavior is tested; no direct test file for penaltyEngineService was found.", evidence: ["server/utils/scheduler.test.js:323", "server/services/penaltyEngineService.js:35"] },
  { finding: "Frontend and backend transition maps differ", status: "Still present", detail: "Canonical status sets match, but backend transitions include reverse/admin paths and archived transitions that the frontend map omits.", evidence: ["web/src/shared/utils/lifecycleNaming.js:61", "server/utils/lifecycleNaming.js:70", "server/utils/lifecycleNaming.js:96"] },
  { finding: "archiveReservation attempts moveIn-to-cancelled", status: "Still present", detail: "Active stay statuses are first assigned cancelled even though moveIn allows only moveOut or archived.", evidence: ["server/controllers/reservations/tenancyActionsController.js:70", "server/controllers/reservations/tenancyActionsController.js:72", "server/utils/lifecycleNaming.js:92"] },
]);

export function renderCodeFindings() {
  return [
    "# Reservation Phase 0 Code-Finding Verification",
    "",
    "This report revalidates only the Phase 0 findings against the inspected commit. It does not change production behavior.",
    "",
    ...CODE_FINDINGS.flatMap((item, index) => [
      `## ${index + 1}. ${item.finding}`,
      "",
      `Status: ${item.status}`,
      "",
      ...(item.detail ? [item.detail, ""] : []),
      `Evidence: ${item.evidence.join(", ")}`,
      "",
    ]),
  ].join("\n");
}
