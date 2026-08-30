/**
 * ============================================================================
 * CANONICAL CONTRACT STATUS LABELS
 * ============================================================================
 *
 * Single source of truth for "what does this Contract status mean in plain
 * English" — covers all 22 CONTRACT_STATUSES (server/models/Contract.js).
 *
 * Backs:
 *   - tenantContractViewService.getTenantContractDisplayStatus (Web + Mobile,
 *     via toTenantContractView's userFacingStatus field)
 *   - web/src/features/admin/utils/contractStatusLabels.js's adminLabel/tone
 *     (Admin Web) — that file is a hand-synced mirror of this one, verified
 *     by server/config/contractStatusLabels.test.js's parity guard, since
 *     web/ and server/ are independent npm projects (no shared-package
 *     mechanism exists to import this module directly into web/'s Vite
 *     build).
 *
 * If you add or rename a status here, update the mirror file too — the
 * parity test will fail loudly if they drift.
 * ============================================================================
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
  rolling: {
    tenantLabel: "Month-to-Month (Rolling)",
    adminLabel: "Rolling Month-to-Month",
    tone: "info",
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
