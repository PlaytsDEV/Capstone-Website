/**
 * Hand-synced mirror of server/config/contractStatusLabels.js.
 *
 * web/ and server/ are independent npm projects (no shared-package
 * mechanism exists to import the server module directly into this Vite
 * build), so this file must be kept in sync manually. A parity guard test —
 * server/config/contractStatusLabels.test.js — imports both files and fails
 * loudly if they drift. If you change this file, update the server one too
 * (and vice versa).
 */
export const CONTRACT_STATUS_LABELS = Object.freeze({
  draft: {
    tenantLabel: "Contract Being Prepared",
    adminLabel: "Draft",
    tone: "neutral",
  },
  incomplete: {
    tenantLabel: "Contract Being Prepared",
    adminLabel: "Incomplete",
    tone: "neutral",
  },
  ready_for_generation: {
    tenantLabel: "Contract Being Prepared",
    adminLabel: "Ready for Generation",
    tone: "info",
  },
  generated: {
    tenantLabel: "Contract Available",
    adminLabel: "Generated",
    tone: "info",
  },
  awaiting_signatures: {
    tenantLabel: "Finalizing — Awaiting Signatures",
    adminLabel: "Awaiting Signatures",
    tone: "warning",
  },
  partially_signed: {
    tenantLabel: "Finalizing — Awaiting Signatures",
    adminLabel: "Partially Signed",
    tone: "warning",
  },
  signed: {
    tenantLabel: "Finalizing — Awaiting Notarization",
    adminLabel: "Signed",
    tone: "info",
  },
  awaiting_notarization: {
    tenantLabel: "Finalizing — Awaiting Notarization",
    adminLabel: "Awaiting Notarization",
    tone: "warning",
  },
  notarized: {
    tenantLabel: "Finalizing — Under Review",
    adminLabel: "Notarized",
    tone: "success",
  },
  ready_for_publication: {
    tenantLabel: "Finalizing — Under Review",
    adminLabel: "Ready for Publication",
    tone: "info",
  },
  published: {
    tenantLabel: "Active Contract",
    adminLabel: "Published",
    tone: "success",
  },
  active: {
    tenantLabel: "Active Contract",
    adminLabel: "Active",
    tone: "success",
  },
  expiring_soon: {
    tenantLabel: "Contract Ending Soon",
    adminLabel: "Expiring Soon",
    tone: "warning",
  },
  expired: {
    tenantLabel: "Contract Ended",
    adminLabel: "Expired",
    tone: "error",
  },
  renewal_pending: {
    tenantLabel: "Renewal Pending",
    adminLabel: "Renewal Pending",
    tone: "info",
  },
  renewed: {
    tenantLabel: "Renewed",
    adminLabel: "Renewed",
    tone: "success",
  },
  transfer_review_required: {
    tenantLabel: "Transfer Under Review",
    adminLabel: "Transfer Under Review",
    tone: "warning",
  },
  terminated: {
    tenantLabel: "Stay Ended Early",
    adminLabel: "Terminated",
    tone: "error",
  },
  cancelled: {
    tenantLabel: "Cancelled",
    adminLabel: "Cancelled",
    tone: "error",
  },
  replaced: {
    tenantLabel: "Previous Contract",
    adminLabel: "Replaced",
    tone: "neutral",
  },
  archived: {
    tenantLabel: "Previous Contract",
    adminLabel: "Archived",
    tone: "neutral",
  },
  voided: {
    tenantLabel: "Voided",
    adminLabel: "Voided",
    tone: "error",
  },
  rejected: {
    tenantLabel: "Rejected",
    adminLabel: "Rejected",
    tone: "error",
  },
});

export const getTenantContractLabel = (status) =>
  CONTRACT_STATUS_LABELS[status]?.tenantLabel || "Contract Status Unavailable";

export const getAdminContractLabel = (status) =>
  CONTRACT_STATUS_LABELS[status]?.adminLabel ||
  String(status || "Unknown").replaceAll("_", " ").replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export const getContractStatusTone = (status) =>
  CONTRACT_STATUS_LABELS[status]?.tone || "neutral";
