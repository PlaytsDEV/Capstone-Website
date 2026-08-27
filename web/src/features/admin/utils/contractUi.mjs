import { CONTRACT_STATUS_LABELS } from "./contractStatusLabels.js";

// Derived from the canonical table (contractStatusLabels.js) — covers all
// 22 CONTRACT_STATUSES, not just the subset previously hand-maintained here.
export const CONTRACT_STATUS_META = Object.freeze(
  Object.fromEntries(
    Object.entries(CONTRACT_STATUS_LABELS).map(([status, meta]) => [
      status,
      { label: meta.adminLabel, tone: meta.tone },
    ]),
  ),
);

export const formatContractStatus = (status) =>
  CONTRACT_STATUS_META[status]?.label ||
  String(status || "Unknown").replaceAll("_", " ").replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export const CONTRACT_STAGE_GROUPS = Object.freeze({
  needs_attention: { label: "Needs Attention", statuses: ["draft", "incomplete", "transfer_review_required"] },
  ready_to_generate: { label: "Ready to Generate", statuses: ["ready_for_generation"] },
  prepared: { label: "Prepared", statuses: ["generated"] },
  pending_signing: { label: "Pending Completion", statuses: ["awaiting_signatures", "partially_signed"] },
  pending_notarization: { label: "Pending Notarization", statuses: ["signed", "awaiting_notarization"] },
  ready_to_publish: { label: "Ready to Publish", statuses: ["notarized", "ready_for_publication"] },
  published: { label: "Published", statuses: ["published"] },
  active: { label: "Active", statuses: ["active"] },
  expiring_soon: { label: "Expiring Soon", statuses: ["expiring_soon"] },
  renewal_pending: { label: "Renewal Pending", statuses: ["renewal_pending"] },
  closed: {
    label: "Expired / Closed",
    statuses: [
      "expired", "terminated", "cancelled", "replaced", "archived",
      "renewed", "voided", "rejected",
    ],
  },
});

export const getContractStageKey = (status) =>
  Object.entries(CONTRACT_STAGE_GROUPS).find(([, group]) => group.statuses.includes(status))?.[0] || "needs_attention";
export const getContractStage = (status) =>
  CONTRACT_STAGE_GROUPS[getContractStageKey(status)]?.label || "Needs Attention";

export const formatContractValue = (value) =>
  String(value || "—").replaceAll("_", " ").replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const CONTRACT_STAGE_NEXT_ACTION = Object.freeze({
  needs_attention: "Complete Missing Information",
  ready_to_generate: "Review and Generate Contract",
  prepared: "Print, sign, notarize, and upload",
  pending_signing: "Complete wet signing and notarization",
  pending_notarization: "Upload notarized copy",
  ready_to_publish: "Review and publish final Contract",
  published: "View final Contract",
  active: "No immediate action",
  expiring_soon: "Review Contract expiry",
  closed: "Review Contract History",
});

export const getContractNextAction = (status) =>
  CONTRACT_STAGE_NEXT_ACTION[getContractStageKey(status)] ||
  "Complete Missing Information";

const ERROR_MESSAGES = Object.freeze({
  DUPLICATE_CURRENT_CONTRACT: "A current Contract already exists for this Stay.",
  DUPLICATE_CONTRACT: "A contract already exists for this approved reservation or stay.",
  CONTRACT_STATUS_NOT_GENERATABLE: "This Contract is not ready for prepared PDF generation.",
  CONTRACT_TEMPLATE_CHECKSUM_MISMATCH: "The official contract template failed its integrity check. Contract generation has been blocked.",
  CONTRACT_FIELD_OVERFLOW: "One or more contract values are too long for the official template. Review the tenant’s legal name or address.",
  TENANT_NAME_TOO_LONG_FOR_TEMPLATE: "The tenant’s legal name is too long for the official template.",
  TENANT_ADDRESS_TOO_LONG_FOR_TEMPLATE: "The tenant’s address is too long for the official template.",
  CONTRACT_BRANCH_ACCESS_DENIED: "You cannot access Contracts from another branch.",
  PERMISSION_DENIED: "Your account does not have permission to manage Contracts.",
  PREPARED_CONTRACT_NOT_FOUND: "The prepared PDF could not be found.",
  PREPARED_DOCUMENT_UNAVAILABLE: "The prepared Contract has not been generated yet.",
  PREPARED_DOCUMENT_STORAGE_MISSING: "The prepared Contract file is missing from storage.",
  PREPARED_DOCUMENT_METADATA_INVALID: "The prepared Contract record is invalid and must be regenerated.",
  CONTRACT_STORAGE_NOT_CONFIGURED: "Persistent Contract document storage is not configured.",
  CONTRACT_REGENERATION_NOT_ALLOWED: "Regeneration is blocked because Contract processing has progressed beyond the prepared-copy stage.",
  CONTRACT_PDF_BROWSER_UNAVAILABLE: "Contract PDF generation is temporarily unavailable because the document renderer is not configured on the server.",
});

export const getContractErrorMessage = (error) => {
  const payload = error?.response?.data || {};
  const code = payload.code || payload.error?.code || error?.code;
  return ERROR_MESSAGES[code] || payload.error || payload.message ||
    error?.message || "The Contract request could not be completed.";
};

export const contractMatchesFilters = (contract, filters) => {
  const search = String(filters.search || "").trim().toLowerCase();
  if (search && ![
    contract.contractNumber,
    contract.tenantLegalName,
  ].some((value) => String(value || "").toLowerCase().includes(search))) return false;
  for (const [filter, field] of [
    ["branch", "branch"],
    ["status", "status"],
    ["roomType", "roomType"],
    ["leaseType", "leaseType"],
  ]) {
    if (filter === "status" && filters[filter] && filters[filter] !== "all") {
      if (!CONTRACT_STAGE_GROUPS[filters[filter]]?.statuses.includes(contract.status)) return false;
    } else if (filters[filter] && filters[filter] !== "all" && contract[field] !== filters[filter]) return false;
  }
  return true;
};
