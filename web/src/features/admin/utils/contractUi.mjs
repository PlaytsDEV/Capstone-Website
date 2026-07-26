export const CONTRACT_STATUS_META = Object.freeze({
  draft: { label: "Draft", tone: "neutral" },
  incomplete: { label: "Incomplete", tone: "neutral" },
  ready_for_generation: { label: "Ready for Generation", tone: "info" },
  generated: { label: "Generated", tone: "info" },
  awaiting_signatures: { label: "Awaiting Signatures", tone: "warning" },
  partially_signed: { label: "Partially Signed", tone: "warning" },
  signed: { label: "Signed", tone: "info" },
  awaiting_notarization: { label: "Awaiting Notarization", tone: "warning" },
  notarized: { label: "Notarized", tone: "success" },
  ready_for_publication: { label: "Ready for Publication", tone: "info" },
  published: { label: "Published", tone: "success" },
  active: { label: "Active", tone: "success" },
  expiring_soon: { label: "Expiring Soon", tone: "warning" },
  expired: { label: "Expired", tone: "error" },
  terminated: { label: "Terminated", tone: "error" },
  cancelled: { label: "Cancelled", tone: "error" },
});

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
  closed: { label: "Expired / Closed", statuses: ["expired", "terminated", "cancelled", "replaced", "archived", "renewed"] },
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
  CONTRACT_STATUS_NOT_GENERATABLE: "This Contract is not ready for prepared PDF generation.",
  CONTRACT_TEMPLATE_CHECKSUM_MISMATCH: "The official contract template failed its integrity check. Contract generation has been blocked.",
  CONTRACT_FIELD_OVERFLOW: "One or more contract values are too long for the official template. Review the tenant’s legal name or address.",
  TENANT_NAME_TOO_LONG_FOR_TEMPLATE: "The tenant’s legal name is too long for the official template.",
  TENANT_ADDRESS_TOO_LONG_FOR_TEMPLATE: "The tenant’s address is too long for the official template.",
  CONTRACT_BRANCH_ACCESS_DENIED: "You cannot access Contracts from another branch.",
  PERMISSION_DENIED: "Your account does not have permission to manage Contracts.",
  PREPARED_CONTRACT_NOT_FOUND: "The prepared PDF could not be found.",
  CONTRACT_REGENERATION_NOT_ALLOWED: "Regeneration is blocked because Contract processing has progressed beyond the prepared-copy stage.",
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
